"""Casos de uso del módulo shift (publicación y ciclo de vida del turno)."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.application.domain.value_objects import ApplicationStatus
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.matching.domain.entities import ShiftRequirement
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.matching.domain.scoring import DEFAULT_MAX_RADIUS_KM, rank_candidates
from app.modules.notification.domain.email_sender import EmailSender
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.application.dtos import EventData, EventResult, ShiftData
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import (
    ShiftNotAssignedToWorkerError,
    ShiftNotFoundError,
)
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import COMMITTED_STATUSES
from app.core.config import settings
from app.modules.subscription.domain.exceptions import PlanLimitExceededError
from app.modules.subscription.domain.plans import get_plan
from app.modules.subscription.domain.repositories import SubscriptionRepository
from app.modules.worker.domain.repositories import WorkerProfileRepository
from app.modules.worker.domain.value_objects import WorkerSkill

logger = logging.getLogger(__name__)


def _naive(dt: datetime) -> datetime:
    """Normaliza a "naive" antes de comparar datetimes: en SQLite (tests) los
    datetimes vuelven sin tzinfo; en Postgres las columnas `TIMESTAMPTZ` sí lo
    preservan. Se asume que ambos valores están en UTC (mismo criterio que
    `subscription.domain.entities._naive`)."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


# R2.4: tolerancia para considerar "puntual" un check-in respecto del
# horario pactado (start_at). Ver docs/REPUTATION.md.
PUNCTUALITY_TOLERANCE = timedelta(minutes=15)

# Reputación del comercio: tolerancia para considerar "a tiempo" un pago
# respecto del fin del turno (end_at). No hay un plazo de pago pactado en el
# dominio (el pago del turno ocurre fuera de la plataforma, sólo se
# autodeclara con `mark_paid`) — 48hs es un valor semilla conservador,
# mismo criterio que `PUNCTUALITY_TOLERANCE`/`NO_SHOW_PERFORMANCE_WEIGHT`:
# ajustable cuando haya datos reales. Ver docs/REPUTATION.md.
PAYMENT_TOLERANCE = timedelta(hours=48)

# Scheduler de asistencia (ADR-0008): tiempo desde `start_at` sin check-in
# antes de mandar el push "¿ya llegaste?" y antes de marcar no-show
# automático. Valores semilla (mismo criterio que las tolerancias de arriba):
# 20 minutos da margen a demoras normales de tráfico/transporte antes de
# molestar con un push; 2 horas es tiempo de sobra para que, si llegó, el
# recordatorio ya haya surtido efecto — pasado eso, asumir no-show.
CHECKIN_REMINDER_DELAY = timedelta(minutes=20)
NO_SHOW_GRACE_PERIOD = timedelta(hours=2)


class ShiftService:
    """Servicio de aplicación para gestionar turnos."""

    def __init__(
        self,
        shifts: ShiftRepository,
        workers: WorkerProfileRepository,
        companies: CompanyProfileRepository,
        notifications: NotificationRepository,
        applications: ShiftApplicationRepository,
        subscriptions: SubscriptionRepository,
        users: UserRepository,
        email_sender: EmailSender,
        # Puerto del motor de matching (no se importa su servicio: se depende
        # del puerto de lectura + la función pura de ranking, ver PRINCIPLES).
        # Opcional para no romper a quien construya el servicio sin él: sin
        # este puerto, publicar sigue funcionando y simplemente no se avisa.
        candidates: CandidateRepository | None = None,
    ) -> None:
        self._shifts = shifts
        self._workers = workers
        self._companies = companies
        self._notifications = notifications
        self._applications = applications
        self._subscriptions = subscriptions
        self._users = users
        self._email_sender = email_sender
        self._candidates = candidates

    async def create_shift(self, company_id: UUID, data: ShiftData) -> Shift:
        """Crea un turno en estado BORRADOR para el comercio dado."""
        shift = Shift(
            company_id=company_id,
            position=data.position,
            quantity=data.quantity,
            start_at=data.start_at,
            end_at=data.end_at,
            pay_amount=data.pay_amount,
            currency=data.currency,
            tips=data.tips,
            dress_code=data.dress_code,
            urgent=data.urgent,
            address=data.address,
            city=data.city,
            latitude=data.latitude,
            longitude=data.longitude,
            title=data.title,
            description=data.description,
            event_id=data.event_id,
            event_name=data.event_name,
        )
        return await self._shifts.add(shift)

    async def create_event(self, company_id: UUID, data: EventData) -> EventResult:
        """Publica de una sola vez todos los turnos de un evento (catering,
        boda, etc. que necesita varios roles a la vez: "3 mozos + 2
        bartenders + 1 cocinero").

        Cada rol se crea y publica como un turno individual normal
        (quantity=1, ADR-0003 intacto), todos comparten un `event_id` nuevo
        para poder verse agrupados/con su progreso de cobertura después. Cada
        turno consume su propio cupo del plan igual que si se hubiera
        publicado uno por uno (misma lógica de `_consume_publication_slot`,
        sin descuento por venir en tanda) — si el plan se queda sin cupo a
        mitad de camino, la publicación queda PARCIAL: se devuelven los que sí
        se pudieron publicar y `requested` para que el caller sepa cuántos
        faltaron."""
        event_id = uuid4()
        requested = sum(role.count for role in data.roles)
        created: list[Shift] = []
        try:
            for role in data.roles:
                for _ in range(role.count):
                    shift = await self.create_shift(
                        company_id,
                        ShiftData(
                            position=role.position,
                            quantity=1,
                            start_at=data.start_at,
                            end_at=data.end_at,
                            pay_amount=role.pay_amount,
                            currency=data.currency,
                            tips=data.tips,
                            dress_code=data.dress_code,
                            urgent=data.urgent,
                            address=data.address,
                            city=data.city,
                            latitude=data.latitude,
                            longitude=data.longitude,
                            title=data.name,
                            description=data.description,
                            event_id=event_id,
                            event_name=data.name,
                        ),
                    )
                    published = await self.publish_shift(company_id, shift.id)
                    created.append(published)
        except PlanLimitExceededError:
            pass  # publicación parcial: se devuelve lo que sí entró en el plan.
        return EventResult(event_id=event_id, requested=requested, shifts=created)

    async def update_shift(
        self, company_id: UUID, shift_id: UUID, data: ShiftData
    ) -> Shift:
        """Actualiza un turno editable propiedad del comercio."""
        shift = await self._get_owned(company_id, shift_id)
        shift.ensure_editable()

        shift.position = data.position
        shift.quantity = data.quantity
        shift.start_at = data.start_at
        shift.end_at = data.end_at
        shift._validate_schedule()
        shift.pay_amount = data.pay_amount
        shift.currency = data.currency
        shift.tips = data.tips
        shift.dress_code = data.dress_code
        shift.urgent = data.urgent
        shift.address = data.address
        shift.city = data.city
        shift.latitude = data.latitude
        shift.longitude = data.longitude
        shift.title = data.title
        shift.description = data.description

        return await self._shifts.update(shift)

    async def publish_shift(self, company_id: UUID, shift_id: UUID) -> Shift:
        shift = await self._get_owned(company_id, shift_id)
        await self._consume_publication_slot(company_id)
        shift.publish()
        published = await self._shifts.update(shift)
        # Reputación del comercio (`events_published`, docs/REPUTATION.md):
        # antes quedaba en 0 para siempre, sin cálculo automático.
        await self._companies.record_published_shift(company_id)
        await self._notify_nearby_workers(published)
        return published

    # Cuántos trabajadores reciben el aviso de turno nuevo. El tope existe
    # para que el aviso siga siendo señal y no ruido: si le llegara a todos,
    # el trabajador termina apagando las notificaciones y perdemos el canal
    # que sostiene la promesa de los 10 minutos.
    NEARBY_NOTIFICATION_LIMIT = 10

    async def _notify_nearby_workers(self, shift: Shift) -> None:
        """Avisa del turno recién publicado a los trabajadores mejor rankeados
        cerca (mismo ranking que ve el comercio en "candidatos": cercanía,
        reputación, puntualidad y desempeño).

        Es el aviso que cierra el circuito del marketplace. Sin él, publicar
        no le avisaba a NADIE: el turno sólo se cubría si algún trabajador
        casualmente abría la app y scrolleaba el feed, con lo cual la misión
        del producto ("cubrir en menos de 10 minutos") dependía del azar.

        Best-effort a propósito: un fallo acá nunca debe impedir que un turno
        quede publicado (mismo contrato que el push en `NotificationRepository`).
        """
        if self._candidates is None:
            return
        try:
            available = await self._candidates.list_available(shift.position)
            ranked = rank_candidates(
                available,
                ShiftRequirement(
                    position=shift.position,
                    latitude=shift.latitude,
                    longitude=shift.longitude,
                ),
                max_radius_km=DEFAULT_MAX_RADIUS_KM,
            )[: self.NEARBY_NOTIFICATION_LIMIT]

            if not ranked:
                return

            company = await self._companies.get_by_id(shift.company_id)
            lugar = company.name if company is not None else "Un comercio cerca tuyo"
            puesto = shift.title or shift.position.value
            for match in ranked:
                await self._notifications.add(
                    Notification(
                        user_id=match.user_id,
                        type=NotificationType.NEW_SHIFT_NEARBY,
                        title=f"Turno de {puesto} cerca tuyo",
                        message=(
                            f"{lugar} está buscando {puesto}. "
                            "Entrá y postulate antes de que lo tomen."
                        ),
                        link="/feed",
                    )
                )
        except Exception:
            logger.exception(
                "Aviso de turno nuevo: fallo inesperado, no se propaga (shift_id=%s)",
                shift.id,
            )

    async def _consume_publication_slot(self, company_id: UUID) -> None:
        """Gating de capacidad por plan (ADR-0005 Fase 1): antes de publicar
        se consulta el plan del comercio vía el puerto de dominio de
        `subscription` (`SubscriptionRepository` + config de planes —
        cero import de la capa de aplicación ajena, mismo patrón cross-módulo
        que `CompanyProfileRepository`/`WorkerProfileRepository`).

        Si el plan tiene tope de turnos y ya se agotó en el período actual,
        levanta `PlanLimitExceededError` (la API la mapea a 402) sin tocar el
        turno ni el contador. No bloquea turnos ya en curso: sólo se llama
        acá, en la transición a `publicado`.

        El TOPE sólo se hace cumplir si `subscriptions_enforced` está activo
        (default OFF): durante la beta temprana se quiere que los comercios
        publiquen libremente para generar liquidez; la mensualidad se enciende
        cuando la operadora decide monetizar (ADR-0005: "beta cerrada = primeros
        comercios en un escalón pago"). El uso se registra igual estando OFF,
        para tener el dato cuando se encienda."""
        now = datetime.now(timezone.utc)
        subscription = await self._subscriptions.get_or_create(company_id)
        subscription.roll_period_if_expired(now)
        plan = get_plan(subscription.plan_code)
        if settings.subscriptions_enforced:
            subscription.ensure_can_publish(plan)
        subscription.register_publication()
        await self._subscriptions.update(subscription)

    async def cancel_shift(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio cancela el turno (terminal, cualquier estado no
        terminal).

        ADR-0007 (Parte C): si el trabajador ya estaba **comprometido**
        (`COMMITTED_STATUSES` — confirmó su asistencia o está en pleno ciclo
        de trabajo) al momento de cancelar, es una **cancelación tardía**: le
        avisamos al trabajador (in-app + push best-effort, mismo mecanismo
        que cualquier otra `Notification`) y le cuesta reputación al
        comercio (`CompanyProfileRepository.record_late_cancellation`,
        simétrico a `record_cancellation`/`record_no_show` del trabajador).
        Cancelar un turno que todavía no tiene a nadie comprometido (p. ej.
        BORRADOR, PUBLICADO, BUSCANDO_PERSONAL o incluso ASIGNADO sin
        confirmar todavía) no tiene este efecto: el trabajador no llegó a
        comprometerse."""
        shift = await self._get_owned(company_id, shift_id)
        was_committed = shift.status in COMMITTED_STATUSES
        affected_worker_profile_id = shift.worker_profile_id
        shift.cancel()
        updated = await self._shifts.update(shift)
        await self._reject_pending_applicants(shift_id)
        if was_committed and affected_worker_profile_id is not None:
            await self._companies.record_late_cancellation(company_id)
            await self._notify_worker(
                affected_worker_profile_id,
                NotificationType.SHIFT_CANCELLED_LATE,
                "El comercio canceló tu turno",
                (
                    f"\"{updated.title or updated.position.value}\" fue cancelado por "
                    "el comercio después de que confirmaste tu asistencia."
                ),
            )
        return updated

    async def mark_no_show(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio marca que el trabajador asignado no se presentó
        (ADR-0007, Parte C): sólo alcanzable desde `CONFIRMADO`/`EN_CAMINO`
        (antes del check-in — si ya hizo check-in, se presentó).

        Efectos: (a) libera el turno (vuelve a `BUSCANDO_PERSONAL`, mismo
        patrón que `worker_cancel`) para re-buscar o, si el comercio lo
        prefiere, cancelarlo con `cancel_shift` a continuación; (b) impacta
        la reputación del trabajador de forma trazable
        (`WorkerProfileRepository.record_no_show`, mismo patrón que
        `record_cancellation` — nunca un UPDATE a mano); (c) queda
        registrado en el propio turno (`Shift.no_show_at`/
        `last_no_show_worker_profile_id`) y notifica al trabajador para que
        pueda ver/disputar el evento."""
        shift = await self._get_owned(company_id, shift_id)
        absent_worker_profile_id = shift.worker_profile_id
        shift.no_show()
        updated = await self._shifts.update(shift)
        await self._restore_rejected_applicants(shift_id)
        if absent_worker_profile_id is not None:
            await self._workers.record_no_show(absent_worker_profile_id)
            await self._notify_worker(
                absent_worker_profile_id,
                NotificationType.SHIFT_NO_SHOW,
                "Te marcaron como no presentado",
                (
                    f"El comercio marcó que no te presentaste al turno "
                    f"\"{updated.title or updated.position.value}\". "
                    "Esto impacta tu reputación."
                ),
            )
        return updated

    async def list_shifts_awaiting_checkin(self) -> list[Shift]:
        """Turnos CONFIRMADO/EN_CAMINO sin check-in, para el scheduler de
        asistencia (ADR-0008). Sin scoping por comercio: lo recorre un
        proceso de sistema, no un request autenticado."""
        return await self._shifts.list_awaiting_checkin()

    async def send_checkin_reminder(self, shift_id: UUID) -> Shift:
        """Push al trabajador para que marque su llegada (ADR-0008): lo
        dispara el scheduler cuando pasó `CHECKIN_REMINDER_DELAY` desde
        `start_at` sin check-in. Marca `checkin_reminder_sent_at` para que el
        scheduler no lo reenvíe en cada tick (idempotente)."""
        shift = await self.get_shift(shift_id)
        shift.checkin_reminder_sent_at = datetime.now(timezone.utc)
        updated = await self._shifts.update(shift)
        if updated.worker_profile_id is not None:
            await self._notify_worker(
                updated.worker_profile_id,
                NotificationType.CHECKIN_REMINDER,
                "¿Ya llegaste a tu turno?",
                (
                    f"Marcá tu llegada en \"{updated.title or updated.position.value}\" "
                    "para confirmar que estás en el lugar."
                ),
            )
        return updated

    async def auto_mark_no_show(self, shift_id: UUID) -> Shift:
        """Marca no-show automático (ADR-0008): lo dispara el scheduler
        cuando pasó `NO_SHOW_GRACE_PERIOD` desde `start_at` sin check-in.
        Reutiliza `mark_no_show` scopeado al `company_id` real del turno (no
        viene de un request de ese comercio, lo dispara un proceso de
        sistema)."""
        shift = await self.get_shift(shift_id)
        return await self.mark_no_show(shift.company_id, shift.id)

    async def assign_worker(
        self, company_id: UUID, shift_id: UUID, worker_profile_id: UUID
    ) -> Shift:
        """El comercio asigna el turno a uno de los candidatos recomendados.

        Este es el momento real de "aceptación" que ve el trabajador (el
        comercio elige a un postulante o asigna directo, ver
        `ApplicationService`): además de la notificación in-app, se le manda
        un email best-effort avisándole (`_send_acceptance_email`).

        Si el trabajador tenía una `ShiftApplication` PENDIENTE a este mismo
        turno, pasa a ACEPTADA (ver `_accept_application`). Si fue asignado
        directo (búsqueda/mapa, sin postulación previa) no hay nada que
        actualizar y no falla. Los demás postulantes del turno pasan a RECHAZADA
        (`_reject_pending_applicants`, TECH_DEBT P5): antes su postulación
        quedaba "pendiente" para siempre aunque ya no tuvieran chance. Si el
        turno se reabre (el asignado rechaza/cancela/no-show), esos rechazos se
        revierten (`_restore_rejected_applicants`)."""
        shift = await self._get_owned(company_id, shift_id)
        shift.assign(worker_profile_id)
        updated = await self._shifts.update(shift)
        await self._accept_application(shift_id, worker_profile_id)
        await self._reject_pending_applicants(shift_id)
        await self._notify_worker(
            worker_profile_id,
            NotificationType.SHIFT_ASSIGNED,
            "Te asignaron un turno",
            f"Te asignaron el turno \"{updated.title or updated.position.value}\". Confirmá tu asistencia.",
        )
        await self._send_acceptance_email(worker_profile_id, updated)
        return updated

    async def _accept_application(self, shift_id: UUID, worker_profile_id: UUID) -> None:
        """Marca ACEPTADA la postulación PENDIENTE de este trabajador a este
        turno, si existe (asignación directa sin postulación previa no tiene
        nada que actualizar acá)."""
        application = await self._applications.get_by_shift_and_worker(
            shift_id, worker_profile_id
        )
        if application is None or application.status != ApplicationStatus.PENDIENTE:
            return
        application.accept()
        await self._applications.update(application)

    async def _reject_pending_applicants(self, shift_id: UUID) -> None:
        """Marca RECHAZADA las postulaciones PENDIENTE que quedan en un turno
        que dejó de estar abierto (se asignó a alguien, o el comercio lo
        canceló): antes quedaban 'pendiente' para siempre (TECH_DEBT P5).

        La del elegido ya pasó a ACEPTADA en `_accept_application` (o nunca
        existió, si fue asignación directa), así que el filtro por PENDIENTE
        nunca la toca: sólo caen los NO elegidos. No se notifica al perdedor a
        propósito (evita un mensaje desalentador que además sería erróneo si el
        turno se reabre; la corrección es sólo de estado para que no quede
        'esperando respuesta' eterno)."""
        for application in await self._applications.list_by_shift(shift_id):
            if application.status == ApplicationStatus.PENDIENTE:
                application.reject()
                await self._applications.update(application)

    async def _restore_rejected_applicants(self, shift_id: UUID) -> None:
        """Vuelve a PENDIENTE las postulaciones que habían quedado RECHAZADA al
        asignar, cuando el turno se REABRE (el asignado lo rechazó, canceló o no
        se presentó): los candidatos que quedaron afuera vuelven a estar en
        carrera. RECHAZADA sólo la escribe el auto-rechazo de arriba, así que
        restaurar todas las del turno es inambiguo (no hay rechazo 'manual' que
        pisar)."""
        for application in await self._applications.list_by_shift(shift_id):
            if application.status == ApplicationStatus.RECHAZADA:
                application.restore()
                await self._applications.update(application)

    async def _send_acceptance_email(
        self, worker_profile_id: UUID, shift: Shift
    ) -> None:
        """Avisa por email al trabajador aceptado para el turno.

        Best-effort: un error acá (proveedor caído, perfil/usuario
        inconsistente) nunca debe romper la asignación, que ya quedó
        persistida. Ver contrato de `EmailSender`."""
        try:
            profile = await self._workers.get_by_id(worker_profile_id)
            if profile is None:
                return
            user = await self._users.get_by_id(profile.user_id)
            if user is None:
                return
            company = await self._companies.get_by_id(shift.company_id)
            company_name = company.name if company is not None else "un comercio"
            position_label = shift.position.value
            when = shift.start_at.strftime("%d/%m/%Y a las %H:%M")
            subject = f"¡Te aceptaron para el turno de {position_label}!"
            html = (
                f"<p>Hola {user.full_name},</p>"
                f"<p>¡Te aceptaron para el turno de {position_label}!</p>"
                f"<p><strong>{company_name}</strong> te asignó el turno del "
                f"{when} hs. Entrá a Oído para confirmar tu asistencia.</p>"
            )
            await self._email_sender.send(to=user.email, subject=subject, html=html)
        except Exception:
            logger.exception(
                "No se pudo enviar el email de aceptación de turno al trabajador %s",
                worker_profile_id,
            )

    async def confirm_assignment(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> Shift:
        """El trabajador asignado confirma su asistencia al turno.

        Regla de doble turno: antes de confirmar se chequea que no haya otro
        turno propio ya comprometido (`COMMITTED_STATUSES`) que se solape en
        horario (`Shift.confirm` hace el chequeo puro; acá sólo se junta la
        lista de turnos a comparar, consultando el repo). Si confirma con
        éxito, se retiran (RETIRADA) automáticamente las postulaciones
        PENDIENTE del trabajador cuyo turno se solapa con el recién
        confirmado: ya no puede trabajarlas, y libera al comercio de perseguir
        un candidato que en los hechos ya está comprometido en otro lado."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        others = await self._shifts.list_by_worker_and_statuses(
            worker_profile_id, COMMITTED_STATUSES
        )
        others = [s for s in others if s.id != shift.id]
        shift.confirm(others)
        updated = await self._shifts.update(shift)
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_CONFIRMED,
            "Confirmaron un turno",
            f"El trabajador asignado confirmó su asistencia al turno \"{updated.title or updated.position.value}\".",
        )
        await self._withdraw_overlapping_applications(worker_profile_id, updated)
        return updated

    async def _withdraw_overlapping_applications(
        self, worker_profile_id: UUID, confirmed_shift: Shift
    ) -> None:
        """Retira (RETIRADA) las postulaciones PENDIENTE del trabajador cuyo
        turno se solapa con el que acaba de confirmar (no puede trabajarlas)."""
        pending = await self._applications.list_pending_by_worker(worker_profile_id)
        for application in pending:
            if application.shift_id == confirmed_shift.id:
                continue
            other_shift = await self._shifts.get_by_id(application.shift_id)
            if other_shift is None or not confirmed_shift.overlaps(other_shift):
                continue
            application.withdraw()
            await self._applications.update(application)

    async def reject_assignment(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> Shift:
        """El trabajador asignado rechaza el turno; vuelve a buscar personal."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.reject()
        updated = await self._shifts.update(shift)
        await self._restore_rejected_applicants(shift_id)
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_REJECTED,
            "Rechazaron un turno",
            f"El trabajador asignado rechazó el turno \"{updated.title or updated.position.value}\". Volvió a buscar personal.",
            # El turno quedó sin cubrir: lo que el comercio necesita es elegir
            # a otro, así que el aviso abre los candidatos de ESE turno.
            link=f"/shifts/{updated.id}/candidates",
        )
        return updated

    async def worker_cancel(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        """El trabajador asignado cancela su asignación ya confirmada
        (ADR-0004): sólo alcanzable desde `CONFIRMADO`, antes del check-in.

        A diferencia de `cancel_shift` (comercio, terminal), esta acción
        **reabre** el turno (vuelve a `BUSCANDO_PERSONAL`, sin trabajador
        asignado) porque el comercio sigue necesitando cubrir el puesto.
        También registra la cancelación en el perfil del trabajador
        (`WorkerProfile.cancellations`), lo que puede afectar sus
        insignias/nivel (ver `worker/domain/rules.py`), y notifica al
        comercio.
        """
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.worker_cancel()
        updated = await self._shifts.update(shift)
        await self._restore_rejected_applicants(shift_id)
        await self._workers.record_cancellation(worker_profile_id)
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_REOPENED,
            "El trabajador canceló su asignación",
            (
                f"El trabajador canceló su asignación al turno "
                f"\"{updated.title or updated.position.value}\" luego de "
                "confirmarla. Volvió a buscar personal."
            ),
            link=f"/shifts/{updated.id}/candidates",
        )
        return updated

    async def depart(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        """El trabajador asignado marca que salió hacia el turno."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.depart()
        return await self._shifts.update(shift)

    async def check_in(
        self, worker_profile_id: UUID, shift_id: UUID, latitude: float, longitude: float
    ) -> Shift:
        """El trabajador marca su llegada al turno con su ubicación."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.check_in(latitude, longitude)
        return await self._shifts.update(shift)

    async def start_working(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        """El trabajador marca el inicio efectivo del turno."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.start_working()
        return await self._shifts.update(shift)

    async def check_out(
        self, worker_profile_id: UUID, shift_id: UUID, latitude: float, longitude: float
    ) -> Shift:
        """El trabajador marca el fin del turno con su ubicación."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.check_out(latitude, longitude)
        updated = await self._shifts.update(shift)
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_CHECKED_OUT,
            "Terminó un turno",
            f"El trabajador terminó el turno \"{updated.title or updated.position.value}\".",
        )
        return updated

    async def finish(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio cierra el turno trabajado.

        R2.4: al finalizar con éxito (el turno sólo llega acá habiendo pasado
        por check-in y check-out, ver `Shift._transition`) se actualizan las
        métricas de reputación reales del trabajador asignado:
        `events_completed` (+1) y `punctuality_rate` (promedio móvil simple
        sobre si el check-in ocurrió dentro de la tolerancia del horario
        pactado). Mismo patrón que las notificaciones: el efecto vive dentro
        del caso de uso que cierra el ciclo, no en un job aparte.
        """
        shift = await self._get_owned(company_id, shift_id)
        shift.finish()
        updated = await self._shifts.update(shift)
        if updated.worker_profile_id is not None:
            await self._workers.record_completed_shift(
                updated.worker_profile_id, punctual=self._was_punctual(updated)
            )
        return updated

    @staticmethod
    def _was_punctual(shift: Shift) -> bool:
        """Puntual = check-in dentro de ±15 min del horario pactado (start_at).

        Normaliza a "naive" antes de comparar: en SQLite (tests) los
        datetimes vuelven sin tzinfo; en Postgres las columnas `TIMESTAMPTZ`
        sí lo preservan. Se asume que ambos valores están en UTC.
        """
        if shift.check_in_at is None:
            return False
        return abs(_naive(shift.check_in_at) - _naive(shift.start_at)) <= PUNCTUALITY_TOLERANCE

    @staticmethod
    def _was_paid_on_time(shift: Shift) -> bool:
        """A tiempo = `paid_at` dentro de `PAYMENT_TOLERANCE` desde `end_at`.

        Mismo criterio de normalización "naive" que `_was_punctual`. `paid_at`
        nunca es `None` acá: `mark_paid()` lo acaba de setear antes de llamar
        a esto (`Shift.mark_paid`, `shift/domain/entities.py`)."""
        assert shift.paid_at is not None
        return _naive(shift.paid_at) - _naive(shift.end_at) <= PAYMENT_TOLERANCE

    async def mark_paid(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio confirma que pagó el turno finalizado.

        Reputación del comercio (`on_time_payment_rate`, docs/REPUTATION.md):
        antes quedaba en 0 para siempre, sin cálculo automático. "A tiempo" =
        `paid_at` (recién seteado por `shift.mark_paid()`) dentro de
        `PAYMENT_TOLERANCE` desde `end_at` — no hay un plazo de pago pactado
        en el dominio (el pago ocurre fuera de la plataforma), así que es un
        valor semilla, no una fecha límite real acordada con el trabajador.
        """
        shift = await self._get_owned(company_id, shift_id)
        shift.mark_paid()
        updated = await self._shifts.update(shift)
        await self._companies.record_payment(
            company_id, on_time=self._was_paid_on_time(updated)
        )
        if updated.worker_profile_id is not None:
            await self._notify_worker(
                updated.worker_profile_id,
                NotificationType.SHIFT_PAID,
                "Te pagaron un turno",
                f"Te pagaron el turno \"{updated.title or updated.position.value}\".",
            )
        return updated

    async def _notify_worker(
        self,
        worker_profile_id: UUID,
        type_: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
    ) -> None:
        profile = await self._workers.get_by_id(worker_profile_id)
        if profile is None:
            return
        await self._notifications.add(
            Notification(
                user_id=profile.user_id,
                type=type_,
                title=title,
                message=message,
                link=link,
            )
        )

    async def _notify_company(
        self,
        company_id: UUID,
        type_: NotificationType,
        title: str,
        message: str,
        link: str | None = None,
    ) -> None:
        profile = await self._companies.get_by_id(company_id)
        if profile is None:
            return
        await self._notifications.add(
            Notification(
                user_id=profile.user_id,
                type=type_,
                title=title,
                message=message,
                link=link,
            )
        )

    async def _get_assigned_to(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        shift = await self.get_shift(shift_id)
        if shift.worker_profile_id != worker_profile_id:
            raise ShiftNotAssignedToWorkerError(str(shift_id))
        return shift

    async def get_shift(self, shift_id: UUID) -> Shift:
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None:
            raise ShiftNotFoundError(str(shift_id))
        return shift

    async def list_company_shifts(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        return await self._shifts.list_by_company(company_id, limit=limit, offset=offset)

    async def list_worker_shifts(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        return await self._shifts.list_by_worker(
            worker_profile_id, limit=limit, offset=offset
        )

    async def list_feed(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        positions: list[WorkerSkill] | None = None,
        urgent: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Shift]:
        return await self._shifts.list_open(
            city=city,
            position=position,
            positions=positions,
            urgent=urgent,
            limit=limit,
            offset=offset,
        )

    async def _get_owned(self, company_id: UUID, shift_id: UUID) -> Shift:
        shift = await self._shifts.get_by_id(shift_id)
        # No revelamos turnos de otros comercios: se tratan como inexistentes.
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))
        return shift
