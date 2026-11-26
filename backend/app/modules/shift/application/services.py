"""Casos de uso del módulo shift (publicación y ciclo de vida del turno)."""

import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.dt import naive as _naive
from app.core.geo import bounding_box, haversine_km
from app.core.tz import ARG_TZ, format_duracion, format_inicio_art, format_turno_art, to_art
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.application.domain.entities import ASSIGNABLE_FROM, ShiftApplication
from app.modules.application.domain.value_objects import (
    ApplicationStatus,
    MotivoDesasignacion,
)
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.favorite.domain.repositories import FavoriteRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.matching.domain.entities import MatchResult, ShiftRequirement
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.matching.domain.scoring import DEFAULT_MAX_RADIUS_KM, rank_candidates
from app.modules.matching.domain.value_objects import ESCALATION_RADIUS_KM
from app.modules.notification.domain.email_sender import EmailSender
from app.modules.notification.domain.email_templates import render_shift_accepted_email_html
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.application.dtos import EventData, EventResult, ShiftData
from app.modules.shift.application.scheduler_signal import notify_scheduler
from app.modules.shift.application.zones import locals_of_unplaced, measuring_zone
from app.modules.shift.domain.entities import (
    REOFFER_MIN_OFFER_WINDOW,
    REOFFER_MIN_REMAINING,
    Reapertura,
    Shift,
)
from app.modules.shift.domain.pay_benchmark import (
    BENCHMARK_WINDOW_DAYS,
    PayBand,
    build_benchmark,
    classify,
    hourly_rate,
)
from app.modules.shift.domain.exceptions import (
    AdminCloseNotAllowedError,
    AssigneeNotFoundError,
    AssigneeUnavailableError,
    InvalidShiftTransitionError,
    ShiftConcurrentModificationError,
    ShiftNotAssignedToWorkerError,
    ShiftNotFoundError,
    ShiftNotEditableError,
)
from app.modules.shift.domain.nearby import FeedOrigin, closest_first, is_nearby, urgent_first
from app.modules.shift.domain.mensajes import no_se_puede
from app.modules.shift.domain.punctuality import PASO_AVISO_AL_COMERCIO, punctuality_of
from app.modules.shift.domain.reconfirmacion import (
    PasoReconfirmacion,
    cancelacion_sin_peso,
)
from app.modules.shift.domain.schedule import (
    mismo_instante,
    validar_horario_nuevo,
    validar_inicio_al_publicar,
)
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.suspension import (
    AccountSuspensionEffects,
    AdminCloseResult,
    SuspendedAccountShiftCloser,
    SuspensionImpact,
    shifts_hidden_by_company_suspension,
    shifts_taken_not_started,
)
from app.modules.shift.domain.value_objects import (
    COMMITTED_STATUSES,
    OPEN_STATUSES,
    AdminClosePlan,
    ShiftStatus,
    TAKEN_NOT_STARTED_STATUSES,
)
from app.core.config import settings
from app.modules.subscription.domain.entities import Subscription
from app.modules.subscription.domain.exceptions import (
    PublishingNotAllowedError,
    SubscriptionNotActiveError,
)
from app.modules.subscription.domain.plans import get_plan
from app.modules.subscription.domain.repositories import SubscriptionRepository
from app.modules.subscription.domain.value_objects import SubscriptionStatus
from app.modules.worker.domain.repositories import WorkerProfileRepository
from app.modules.worker.domain.value_objects import WorkerSkill

logger = logging.getLogger(__name__)

# Cuántos turnos nombra el aviso de postulaciones retiradas (U123).
_MAX_NAMED_SHIFTS = 3
# Intentos de apagar «va en camino» si choca con otra escritura (U072).
_STOP_EN_ROUTE_ATTEMPTS = 3


# Reputación del comercio: tolerancia para considerar "a tiempo" un pago
# respecto del fin del turno (end_at). No hay un plazo de pago pactado en el
# dominio (el pago del turno ocurre fuera de la plataforma, sólo se
# autodeclara con `mark_paid`) — 48hs es un valor semilla conservador,
# mismo criterio que `PUNCTUALITY_TOLERANCE`/`NO_SHOW_PERFORMANCE_WEIGHT`:
# ajustable cuando haya datos reales. Ver docs/reference/REPUTATION.md.
PAYMENT_TOLERANCE = timedelta(hours=48)

# Cuánto después del horario de inicio se marca la ausencia sola. Los
# recordatorios de llegada (10 minutos antes, a la hora y 5 después) viven en
# `shift/domain/punctuality.py`; 2 horas es tiempo de sobra para que, si
# llegó, alguno haya surtido efecto o el comercio haya dicho «Ya llegó».
NO_SHOW_GRACE_PERIOD = timedelta(hours=2)

# "Va en camino": cuánto antes del inicio se le recuerda al trabajador que
# avise al salir. Una hora y media cubre el viaje típico en AMBA (colectivo +
# subte) sin llegar tan temprano que el aviso se olvide. Tiene que ser menor
# que `EN_ROUTE_WINDOW` (2h): si no, el botón al que lleva el push todavía
# estaría rechazando el reporte.
DEPARTURE_REMINDER_LEAD = timedelta(minutes=90)

# Escalada automática de urgencia: cuánto tiempo desde `published_at` sin
# cubrirse antes de subirle la prioridad al turno y avisar a un círculo más
# amplio de candidatos. Valor semilla (mismo criterio que las tolerancias de
# arriba): un poco antes de los 10 minutos de la promesa central
# (PRODUCT.md), para actuar mientras todavía hay margen y no después de
# incumplirla.
ESCALATION_DELAY = timedelta(minutes=8)

# "No cubierto" (ADR-0015): cuánto esperar después de `start_at` antes de
# resolver solo un turno que nunca llegó a CONFIRMADO. Depende de `urgent`
# —la misma señal que ya usa el comercio/la escalada para decir "esto es
# inmediato"—, a pedido explícito de Julieta: un turno urgente no debe seguir
# figurando como activo mucho después de su hora, uno con más margen puede
# esperar un poco más por si hay una confirmación tardía real. NORMAL
# reutiliza el mismo valor que NO_SHOW_GRACE_PERIOD, no es una coincidencia:
# es el mismo margen que el resto del sistema ya considera razonable para un
# check-in/confirmación demorados.
NOT_COVERED_GRACE_URGENT = timedelta(minutes=30)
NOT_COVERED_GRACE_NORMAL = NO_SHOW_GRACE_PERIOD

# Turno con la salida marcada que el comercio no cierra (ADR-0008, decisión
# 24 de Julieta): sin cerrar queda «en marcha» para siempre y la persona no
# puede calificar ni verlo en sus ganancias. Medidos desde `check_out_at`: al
# día se le recuerda al comercio que lo cierre; a los tres días Oído lo
# cierra solo, con la puntualidad que ya quedó registrada en la llegada.
FINISH_REMINDER_DELAY = timedelta(hours=24)
AUTO_FINISH_DELAY = timedelta(hours=72)

# Hasta dónde llega «cerca» en el feed del trabajador (Inicio y Mapa): el
# mismo círculo máximo al que puede llegar un aviso de ese turno, el de la
# escalada. Midiendo desde la zona del perfil, la lista y el aviso no se
# contradicen: lo que te pueden avisar lo ves, y lo que ves te lo podrían
# avisar. La excepción es «Disponible ahora»: mientras está prendido el
# aviso mide desde esa posición (ADR-0014) y el feed sigue midiendo desde la
# zona del perfil, así que puede llegar un aviso de un turno que el Inicio no
# lista (se abre igual: el aviso lleva al turno). Ver `get_feed_origin`.
FEED_RADIUS_KM = ESCALATION_RADIUS_KM


def coverage_deadline(shift: Shift) -> datetime:
    """Hasta cuándo se espera que un turno sin nadie confirmado se cubra
    antes de resolverlo como «no cubierto» (ADR-0015), sin zona («naive», como
    compara el scheduler).

    Lo normal es `start_at` más una gracia que depende de `urgent`. El turno
    reofrecido (U080) ya empezó y se ofrece mientras le queden al menos
    `REOFFER_MIN_REMAINING` de horario: su plazo es `offered_until`."""
    if shift.is_reoffered:
        return _naive(shift.offered_until)
    grace = NOT_COVERED_GRACE_URGENT if shift.urgent else NOT_COVERED_GRACE_NORMAL
    return _naive(shift.start_at) + grace


def _pesos(amount) -> str:
    """Monto para una frase: «$15.000» (peso entero, punto de miles)."""
    return f"${amount:,.0f}".replace(",", ".")


def _hora(moment: datetime) -> str:
    """Hora argentina para una frase: «23:00»."""
    return f"{to_art(moment):%H:%M}"


class ShiftService(AccountSuspensionEffects, SuspendedAccountShiftCloser):
    """Servicio de aplicación para gestionar turnos.

    También implementa los puertos `AccountSuspensionEffects` (ADR-0024): la
    administración le pide por ahí qué pasa con los turnos de una cuenta que
    va a suspender, sin importar este caso de uso; y
    `SuspendedAccountShiftCloser` (decisión 21): «Cerrar turno» de un turno
    empezado de una cuenta suspendida."""

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
        # Favoritos del comercio: siempre entran en el aviso de turno nuevo
        # (ver `_notify_nearby_workers`). Opcional por el mismo motivo que
        # `candidates`: sin él, el aviso sigue saliendo, sólo que sin ellos.
        favorites: FavoriteRepository | None = None,
        # Cómo correr trabajo DESPUÉS de responder (en la API, el
        # `BackgroundTasks.add_task` del request). Lo usa el email de
        # aceptación para no hacer esperar al comercio al proveedor de email
        # (hasta 10 s de timeout). Sin él (scheduler, tests de servicio) se
        # corre en el momento, como antes.
        run_after_response: Callable[..., None] | None = None,
        # Reconfirmación antes del turno (ADR-0031, P3). Apagada por defecto
        # (`settings.reconfirmacion_enabled`): sin ella no se pregunta nada
        # y «Sí, sigo disponible» no existe. Que avisar con 24 horas no sume una
        # cancelación no depende de esto: vale siempre.
        reconfirmacion_activa: bool = False,
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
        self._favorites = favorites
        self._run_after_response = run_after_response
        self._reconfirmacion_activa = reconfirmacion_activa

    async def create_shift(self, company_id: UUID, data: ShiftData) -> Shift:
        """Crea un turno en estado BORRADOR para el comercio dado."""
        validar_horario_nuevo(data.start_at, data.end_at)
        shift = Shift(
            company_id=company_id,
            position=data.position,
            quantity=data.quantity,
            start_at=data.start_at,
            end_at=data.end_at,
            pay_amount=data.pay_amount,
            currency=data.currency,
            tips=data.tips,
            meal=data.meal,
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
        publicado uno por uno (pasa por `publish_shift`, sin descuento por
        venir en tanda) — si el plan se queda sin cupo a
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
                            meal=data.meal,
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
                    # Sin aviso por puesto: sale uno solo por evento y por
                    # persona al terminar (`_notify_event_workers`, U086).
                    published = await self.publish_shift(
                        company_id, shift.id, notify_nearby=False
                    )
                    created.append(published)
        except PublishingNotAllowedError as exc:
            # Sin plan pago vigente (ADR-0022) no se publicó nada: que llegue
            # el 402 con el mensaje, no un evento vacío.
            if isinstance(exc, SubscriptionNotActiveError) and not created:
                raise
            # Si no, publicación parcial: se devuelve lo que sí entró en el plan.
        await self._notify_event_workers(created)
        return EventResult(event_id=event_id, requested=requested, shifts=created)

    async def update_shift(
        self, company_id: UUID, shift_id: UUID, data: ShiftData
    ) -> Shift:
        """Actualiza un turno editable propiedad del comercio."""
        shift = await self._get_owned(company_id, shift_id)
        shift.ensure_editable()
        # Con gente postulada, el turno sigue siendo el mismo turno: se puede
        # corregir el horario o el pago (se les avisa), no el puesto, que es
        # otro trabajo.
        postulados = await self._active_applicants(shift)
        if postulados and data.position != shift.position:
            raise ShiftNotEditableError(
                "Ya hay personas postuladas: no se puede cambiar el puesto. "
                "Cancelá este turno y publicá uno nuevo."
            )
        avisar = bool(postulados) and shift.cambio_importante(
            start_at=data.start_at, end_at=data.end_at, pay_amount=data.pay_amount
        )

        # La regla de horario de un turno nuevo (inicio no pasado, 1 a 16 h)
        # sólo corre si se cambia el horario: reenviar el mismo de un borrador
        # cuyo inicio ya pasó no puede fallar por eso.
        inicio_igual = mismo_instante(shift.start_at, data.start_at)
        if not (inicio_igual and mismo_instante(shift.end_at, data.end_at)):
            validar_horario_nuevo(data.start_at, data.end_at, validar_inicio=not inicio_igual)
        shift.position = data.position
        shift.quantity = data.quantity
        shift.start_at = data.start_at
        shift.end_at = data.end_at
        shift._validate_schedule()
        shift.pay_amount = data.pay_amount
        shift.currency = data.currency
        shift.tips = data.tips
        shift.meal = data.meal
        shift.dress_code = data.dress_code
        shift.urgent = data.urgent
        shift.address = data.address
        shift.city = data.city
        shift.latitude = data.latitude
        shift.longitude = data.longitude
        shift.title = data.title
        shift.description = data.description

        updated = await self._shifts.update(shift)
        if avisar:
            await self._notify_applicants_of_change(updated, postulados)
        return updated

    async def _active_applicants(self, shift: Shift) -> list[UUID]:
        """Perfiles con una postulación en carrera a un turno ya publicado."""
        if shift.status == ShiftStatus.BORRADOR:
            return []
        return [
            a.worker_profile_id
            for a in await self._applications.list_by_shift(shift.id)
            if a.status == ApplicationStatus.PENDIENTE
        ]

    async def _notify_applicants_of_change(
        self, shift: Shift, worker_profile_ids: list[UUID]
    ) -> None:
        """El comercio corrigió el horario o bajó el pago: quien se había
        postulado se entera y decide si sigue (retirarse no cuesta nada)."""
        nombre = await self._shift_name_with_company(shift)
        cuando = format_turno_art(shift.start_at, shift.end_at)
        pago = f"{shift.pay_amount:,.0f}".replace(",", ".")
        for worker_profile_id in worker_profile_ids:
            await self._notify_worker(
                worker_profile_id,
                NotificationType.APPLIED_SHIFT_CHANGED,
                "Cambió un turno al que te postulaste",
                (
                    f"{nombre} ahora es el {cuando} y paga ${pago}. "
                    "Mirá si te sigue sirviendo; si no, podés retirar tu postulación."
                ),
                link="/my-shifts",
            )

    async def publish_shift(
        self, company_id: UUID, shift_id: UUID, *, notify_nearby: bool = True
    ) -> Shift:
        """Publica el turno. `notify_nearby=False` lo usa la publicación de un
        evento: el aviso lo manda después `_notify_event_workers`, uno por
        persona y no uno por puesto."""
        shift = await self._get_owned(company_id, shift_id)
        if shift.status == ShiftStatus.BORRADOR:
            validar_inicio_al_publicar(shift.start_at)
        # El plan se consulta antes y se cuenta después: el uso sube recién
        # cuando el turno quedó guardado como publicado. Antes se sumaba
        # primero, y como cada repositorio guarda por su cuenta, un intento
        # que fallaba acá abajo (el turno ya estaba publicado, o lo cambió
        # otro pedido a la vez) dejaba igual un turno gastado en el plan.
        await self._ensure_publication_allowed(company_id)
        shift.publish()
        published = await self._shifts.update(shift)
        await self._register_publication(company_id)
        # Reputación del comercio (`events_published`, docs/reference/REPUTATION.md):
        # antes quedaba en 0 para siempre, sin cálculo automático.
        await self._companies.record_published_shift(company_id)
        logger.info(
            "shift.published",
            extra={"shift_id": str(published.id), "company_id": str(company_id)},
        )
        if notify_nearby:
            await self._notify_nearby_workers(published)
        # Nueva deadline: la escalada de urgencia a los `ESCALATION_DELAY`.
        # Despierta al scheduler (que ahora duerme hasta la próxima deadline en
        # vez de sondear) para que no se pierda esa ventana. Ver
        # `scheduler_signal.py`.
        notify_scheduler()
        return published

    # Cuántos trabajadores reciben el aviso de turno nuevo. El tope existe
    # para que el aviso siga siendo señal y no ruido: si le llegara a todos,
    # el trabajador termina apagando las notificaciones y perdemos el canal
    # que sostiene la promesa de los 10 minutos.
    NEARBY_NOTIFICATION_LIMIT = 10

    # Escalada (`escalate_urgency`): círculo más amplio que la primera tanda
    # —más candidatos y más radio (`ESCALATION_RADIUS_KM`, 40 km contra 25,
    # los dos en el dominio de matching)— a propósito. No hay forma de excluir a
    # quienes ya recibieron el primer aviso (`Notification` no tiene
    # `shift_id`, ver `notification/domain/entities.py`), así que puede haber
    # solapamiento; se acepta como costo menor: un recordatorio duplicado
    # para quien lo vio y no se postuló es, si acaso, la señal de urgencia
    # haciendo su trabajo, no un bug.
    ESCALATION_NOTIFICATION_LIMIT = 20

    async def _rank_nearby(
        self,
        shift: Shift,
        *,
        max_radius_km: float,
        limit: int | None,
        exclude_profile_ids: frozenset[UUID] = frozenset(),
    ) -> list[MatchResult]:
        """A quiénes se les avisa de un turno: los mejor rankeados dentro del
        radio (hasta `limit`) más los favoritos del comercio. Sin quien ya
        está comprometido en un puesto del mismo evento que se pisa de horario,
        y sin `exclude_profile_ids` (quien tuvo ese turno y lo dejó, al
        reofrecerlo): se sacan antes del tope, así el lugar lo ocupa el que
        sigue. Lanza lo que lance la base: el que llama decide si lo traga."""
        if self._candidates is None:
            return []
        # Se resuelve acá y no como default del parámetro para que el tope se
        # lea al llamar (los tests lo bajan para aislar a los favoritos).
        if limit is None:
            limit = self.NEARBY_NOTIFICATION_LIMIT
        available = await self._candidates.list_available(shift.position)
        zone = await measuring_zone(shift, self._companies)
        if not zone.is_known:
            # Ni el turno ni el local dicen dónde es: no hay contra qué
            # medir y no se le avisa a nadie. Que quede a la vista.
            logger.warning(
                "shift.unplaced",
                extra={"shift_id": str(shift.id), "company_id": str(shift.company_id)},
            )
        ranked_all = rank_candidates(
            available,
            ShiftRequirement(
                position=shift.position,
                latitude=zone.latitude,
                longitude=zone.longitude,
                city=zone.city,
            ),
            max_radius_km=max_radius_km,
        )
        # Los favoritos del comercio entran siempre, además del tope: son
        # los que ya le resolvieron un turno, y el que más chances tiene
        # de cubrir el próximo rápido es alguien que ya conoce el local
        # (en Instawork y Brigad, el 85–93% de los comercios repite
        # trabajador). Sin esto, un favorito que no quedaba entre los
        # mejores rankeados ni se enteraba. No hay ventana exclusiva para
        # ellos a propósito: demoraría el aviso al resto y va contra los
        # 10 minutos. Siguen pasando por `rank_candidates`, así que un
        # favorito que no está disponible, no tiene el puesto o está
        # fuera del radio no recibe nada. Es la única forma en que marcar
        # favorito afecta algo: el ranking y la reputación siguen sin leerlo.
        favorite_ids = (
            await self._favorites.list_worker_ids_by_company(shift.company_id)
            if self._favorites is not None
            else set()
        )
        if exclude_profile_ids:
            ranked_all = [m for m in ranked_all if m.profile_id not in exclude_profile_ids]
        if shift.event_id is not None:
            # Evento (U086): quien ya está comprometido en otro puesto del mismo
            # evento no puede tomar éste (el horario es el mismo): sin aviso.
            # Se saca ANTES del tope, así el lugar lo ocupa el que sigue.
            ranked_all = [
                m for m in ranked_all if not await self._committed_in_event(m, shift)
            ]
        return [m for m in ranked_all if m.profile_id in favorite_ids] + [
            m for m in ranked_all if m.profile_id not in favorite_ids
        ][:limit]

    async def _committed_in_event(self, match: MatchResult, shift: Shift) -> bool:
        """¿Ya está confirmada (o más adelante) en otro puesto del mismo evento
        cuyo horario se pisa con `shift`?"""
        committed = await self._shifts.list_by_worker_and_statuses(
            match.profile_id, COMMITTED_STATUSES
        )
        return any(
            other.event_id == shift.event_id
            and other.id != shift.id
            and shift.overlaps(other)
            for other in committed
        )

    async def notify_event_escalation(self, shifts: list[Shift]) -> None:
        """La escalada de los puestos de evento que vencieron en el mismo tick
        (`escalate_urgency(notify=False)`): un solo aviso urgente por evento y
        por persona, no uno por puesto (U086). Los turnos sueltos no pasan por
        acá."""
        by_event: dict[UUID, list[Shift]] = {}
        for shift in shifts:
            if shift.event_id is not None:
                by_event.setdefault(shift.event_id, []).append(shift)
        for group in by_event.values():
            await self._notify_event_workers(group, escalation=True)

    async def _notify_event_workers(
        self, shifts: list[Shift], *, escalation: bool = False
    ) -> None:
        """Un solo aviso por evento y por persona, en vez de uno por puesto
        (U086): «Evento X: 5 puestos cerca tuyo». Cuenta los puestos del evento
        que le corresponden a cada persona (según su oficio y la distancia) y
        abre el primero, donde se postula. Un evento de un solo puesto avisa
        como un turno suelto. Best-effort, igual que `_notify_nearby_workers`."""
        if not shifts:
            return
        radius = ESCALATION_RADIUS_KM if escalation else DEFAULT_MAX_RADIUS_KM
        limit = self.ESCALATION_NOTIFICATION_LIMIT if escalation else None
        notification_type = (
            NotificationType.URGENT_SHIFT_NEARBY
            if escalation
            else NotificationType.NEW_SHIFT_NEARBY
        )
        if len(shifts) == 1:
            if escalation:
                await self._notify_nearby_workers(
                    shifts[0],
                    max_radius_km=radius,
                    limit=limit,
                    notification_type=notification_type,
                    escalation=True,
                )
            else:
                await self._notify_nearby_workers(shifts[0])
            return
        if self._candidates is None:
            return
        try:
            per_user: dict[UUID, list[Shift]] = {}
            for shift in shifts:
                for match in await self._rank_nearby(
                    shift, max_radius_km=radius, limit=limit
                ):
                    per_user.setdefault(match.user_id, []).append(shift)
            if not per_user:
                return
            first = shifts[0]
            company = await self._companies.get_by_id(first.company_id)
            lugar = company.name if company is not None else "Un comercio cerca tuyo"
            nombre = first.event_name or first.title or "Evento"
            notifications = []
            for user_id, mine in per_user.items():
                n = len(mine)
                puestos = f"{n} puesto" if n == 1 else f"{n} puestos"
                urgent = escalation or any(s.urgent for s in mine)
                notifications.append(
                    Notification(
                        user_id=user_id,
                        type=notification_type,
                        title=(
                            f"¡Urgente! Evento {nombre}: {puestos} cerca tuyo"
                            if urgent
                            else f"Evento {nombre}: {puestos} cerca tuyo"
                        ),
                        message=(
                            f"{lugar} todavía necesita cubrir {puestos} de \"{nombre}\" "
                            "y no encuentra a nadie. Postulate ahora."
                            if escalation
                            else f"{lugar} busca personal para \"{nombre}\". "
                            "Entrá y postulate antes de que lo tomen."
                        ),
                        link=f"/turno/{mine[0].id}",
                    )
                )
            await self._notifications.add_many(notifications)
        except Exception:
            logger.exception(
                "Aviso de evento: fallo inesperado, no se propaga (event_id=%s)",
                shifts[0].event_id,
            )

    async def _notify_nearby_workers(
        self,
        shift: Shift,
        *,
        max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
        limit: int | None = None,
        notification_type: NotificationType = NotificationType.NEW_SHIFT_NEARBY,
        escalation: bool = False,
        reoffer: bool = False,
        exclude_profile_ids: frozenset[UUID] = frozenset(),
    ) -> None:
        """Avisa del turno a los trabajadores mejor rankeados cerca (mismo
        ranking que ve el comercio en "candidatos": cercanía, reputación,
        puntualidad y desempeño).

        «Cerca» es un límite duro: `rank_candidates` deja afuera a quien está
        más lejos que `max_radius_km` (o, sin distancia que medir, a quien no
        es de la ciudad del turno). El aviso dice «cerca tuyo»: a alguien de
        otra provincia no se le manda, tampoco si es favorito. El turno se
        mide desde su zona o, si no tiene ninguna, desde el local del comercio
        (`measuring_zone`).

        Es el aviso que cierra el circuito del marketplace. Sin él, publicar
        no le avisaba a NADIE: el turno sólo se cubría si algún trabajador
        casualmente abría la app y scrolleaba el feed, con lo cual la misión
        del producto ("cubrir en menos de 10 minutos") dependía del azar.
        Reutilizado por `escalate_urgency` con un radio/tope más amplios
        cuando el turno tarda en cubrirse (`escalation=True`).

        El texto sigue a `shift.urgent`: un turno que el comercio publica ya
        marcado como urgente avisa como urgente desde la primera tanda, no
        recién a los `ESCALATION_DELAY`. El tipo sigue siendo
        `NEW_SHIFT_NEARBY` (primera tanda); `URGENT_SHIFT_NEARBY` queda para
        la escalada, que es lo que la distingue.

        `reoffer=True` (U080, lo llama `_notify_reoffer`): el turno ya empezó
        y se volvió a ofrecer. El texto lo dice y muestra el valor por hora,
        porque el total depende de cuándo llegue quien lo tome.

        Best-effort a propósito: un fallo acá nunca debe impedir que un turno
        quede publicado (mismo contrato que el push en `NotificationRepository`).
        """
        try:
            ranked = await self._rank_nearby(
                shift,
                max_radius_km=max_radius_km,
                limit=limit,
                exclude_profile_ids=exclude_profile_ids,
            )
            if not ranked:
                return

            company = await self._companies.get_by_id(shift.company_id)
            lugar = company.name if company is not None else "Un comercio cerca tuyo"
            puesto = shift.title or shift.position.label
            if reoffer:
                title = f"¡Urgente! {puesto} para ahora, cerca tuyo"
                por_hora = shift.hourly_pay_amount
                paga = (
                    f"Paga {_pesos(por_hora)} por hora, desde que llegás. "
                    if por_hora is not None
                    else "Se paga desde que llegás. "
                )
                message = (
                    f"{lugar} necesita cubrir {puesto} ya: el turno empezó y va "
                    f"hasta las {_hora(shift.end_at)}. {paga}Postulate ahora."
                )
            elif escalation:
                title = f"¡Urgente! Turno de {puesto} cerca tuyo"
                message = (
                    f"{lugar} todavía necesita cubrir {puesto} y no encuentra a nadie. "
                    "Postulate ahora."
                )
            elif shift.urgent:
                title = f"¡Urgente! Turno de {puesto} cerca tuyo"
                message = (
                    f"{lugar} necesita cubrir {puesto} ya. "
                    "Postulate ahora, antes de que lo tomen."
                )
            else:
                title = f"Turno de {puesto} cerca tuyo"
                message = (
                    f"{lugar} está buscando {puesto}. "
                    "Entrá y postulate antes de que lo tomen."
                )
            await self._notifications.add_many(
                [
                    Notification(
                        user_id=match.user_id,
                        type=notification_type,
                        title=title,
                        message=message,
                        # Al turno, no al Inicio: con el Inicio abierto un link
                        # a /feed no hacía nada y el turno no aparecía hasta
                        # recargar. En /turno/{id} la persona se postula.
                        link=f"/turno/{shift.id}",
                    )
                    for match in ranked
                ]
            )
        except Exception:
            logger.exception(
                "Aviso de turno: fallo inesperado, no se propaga (shift_id=%s)",
                shift.id,
            )

    async def list_shifts_awaiting_escalation(self) -> list[Shift]:
        """Turnos abiertos sin escalar, para el scheduler de urgencia (sin los
        de comercios suspendidos, ADR-0024: ver el repositorio)."""
        return await self._shifts.list_open_awaiting_escalation()

    async def escalate_urgency(self, shift_id: UUID, *, notify: bool = True) -> Shift:
        """Escalada automática (mismo scheduler que ADR-0008): un turno que
        no se cubre rápido sube de prioridad y llega a más candidatos.

        Efectos: (a) `urgent=True` — el turno sube al principio del feed
        (`ShiftRepository.list_open` ya ordena por `urgent` primero); (b) un
        segundo aviso a un círculo más amplio de candidatos
        (`ESCALATION_RADIUS_KM`/`ESCALATION_NOTIFICATION_LIMIT`, mayores que
        la primera tanda de `publish_shift`). `escalated_at` marca que ya
        pasó, para que el scheduler no lo repita en cada tick."""
        shift = await self.get_shift(shift_id)
        shift.urgent = True
        shift.escalated_at = datetime.now(timezone.utc)
        updated = await self._shifts.update(shift)
        logger.info("shift.escalated", extra={"shift_id": str(updated.id)})
        if not notify:
            # Puesto de evento: el scheduler junta los del tick y manda un solo
            # aviso por persona (`notify_event_escalation`).
            return updated
        await self._notify_nearby_workers(
            updated,
            max_radius_km=ESCALATION_RADIUS_KM,
            limit=self.ESCALATION_NOTIFICATION_LIMIT,
            notification_type=NotificationType.URGENT_SHIFT_NEARBY,
            escalation=True,
        )
        return updated

    async def _notify_reoffer(self, shift: Shift) -> None:
        """El aviso urgente de un turno reofrecido (U080): a quienes están
        cerca con el círculo de la escalada y a los favoritos, una vez por
        reapertura (lo llama el caso de uso que reabrió, que sólo puede pasar
        una vez por ciclo: la transición no se repite).

        Sin quien ya tuvo ESE turno y lo dejó (postulación `desasignada`,
        ADR-0026): no puede postularse otra vez, así que el aviso lo llevaría
        a un botón que no anda. Best-effort, como todo aviso de turno; también
        despierta al scheduler: el plazo de «no cubierto» pasó a `end_at`."""
        excluded: frozenset[UUID] = frozenset()
        try:
            excluded = frozenset(
                a.worker_profile_id
                for a in await self._applications.list_by_shift(shift.id)
                if a.status == ApplicationStatus.DESASIGNADA
            )
        except Exception:
            logger.exception(
                "Turno reofrecido: no se pudo leer quién lo dejó (shift_id=%s)", shift.id
            )
        await self._notify_nearby_workers(
            shift,
            max_radius_km=ESCALATION_RADIUS_KM,
            limit=self.ESCALATION_NOTIFICATION_LIMIT,
            notification_type=NotificationType.URGENT_SHIFT_NEARBY,
            reoffer=True,
            exclude_profile_ids=excluded,
        )
        notify_scheduler()

    async def _worker_name(self, worker_profile_id: UUID | None) -> str | None:
        """Nombre de la persona para un aviso al comercio dueño del turno
        (que ya lo ve en su panel). `None` si no se puede resolver."""
        if worker_profile_id is None:
            return None
        worker = await self._workers.get_by_id(worker_profile_id)
        if worker is None:
            return None
        user = await self._users.get_by_id(worker.user_id)
        return user.full_name if user is not None and user.full_name else None

    async def _record_reopen(
        self,
        updated: Shift,
        outcome: Reapertura,
        *,
        left_worker_profile_id: UUID | None,
        motivo: MotivoDesasignacion,
    ) -> None:
        """Primera mitad de la cola de toda reapertura decidida por alguien
        del turno (rechazo, cancelación, ausencia), con el turno ya guardado:
        devuelve a la carrera a los postulantes que habían quedado rechazados
        (salvo que el turno haya quedado sin cubrir: ya no hay carrera) y deja
        la marca de quien lo dejó (ADR-0026). Los avisos van después, en
        `_announce_reopen`: entre las dos el caso de uso registra lo que le
        toca a la reputación, para que un aviso que falle no se lo saltee."""
        if outcome is not Reapertura.SIN_CUBRIR:
            await self._restore_rejected_applicants(updated.id)
        if left_worker_profile_id is not None:
            await self._mark_unassigned(updated.id, left_worker_profile_id, motivo)
        if outcome is Reapertura.REOFRECIDO:
            logger.info(
                "shift.reoffered",
                extra={"shift_id": str(updated.id), "company_id": str(updated.company_id)},
            )
        elif outcome is Reapertura.SIN_CUBRIR:
            logger.info(
                "shift.not_covered",
                extra={
                    "shift_id": str(updated.id),
                    "company_id": str(updated.company_id),
                    "reason": "sin_horario_para_reofrecer",
                },
            )

    async def _announce_reopen(
        self,
        updated: Shift,
        outcome: Reapertura,
        *,
        left_worker_profile_id: UUID | None,
        motivo: MotivoDesasignacion | None,
        automatic: bool = False,
    ) -> None:
        """Segunda mitad: **un** aviso al comercio que dice qué pasó y qué
        sigue y, si el turno se reofreció, el aviso urgente a quienes están
        cerca (U080). `motivo=None` es la suspensión de la cuenta de la
        persona (ADR-0024): no fue una decisión suya y no deja marca.

        Con la cuenta del comercio suspendida no sale ninguno (decisión 22):
        su turno está oculto, así que el aviso urgente ofrecería algo que
        nadie puede ver ni tomar, y a la cuenta suspendida no se le avisa."""
        if not await self.company_account_active(updated.company_id):
            logger.info(
                "shift.reopen_not_announced",
                extra={"shift_id": str(updated.id), "reason": "company_suspended"},
            )
            return
        await self._notify_company_reopened(
            updated,
            outcome,
            left_worker_profile_id=left_worker_profile_id,
            motivo=motivo,
            automatic=automatic,
        )
        if outcome is Reapertura.REOFRECIDO:
            await self._notify_reoffer(updated)

    async def _notify_company_reopened(
        self,
        shift: Shift,
        outcome: Reapertura,
        *,
        left_worker_profile_id: UUID | None,
        motivo: MotivoDesasignacion | None,
        automatic: bool,
    ) -> None:
        """El aviso al comercio cuando quien tenía su turno lo dejó. Uno
        solo por reapertura, con qué pasó y qué sigue.

        Antes de U080 la ausencia no le avisaba nada al comercio: se enteraba
        por el panel o por el «no cubierto» de más tarde. Una ausencia siempre
        cae con el turno empezado, así que siempre llega acá como reoferta o
        como cierre."""
        turno = shift.title or shift.position.label
        candidatos = f"/shifts/{shift.id}/candidates"

        if motivo is MotivoDesasignacion.AUSENCIA:
            quien = await self._worker_name(left_worker_profile_id) or "la persona confirmada"
            if automatic:
                paso = f"No registramos la llegada de {quien} a \"{turno}\"."
                titulo = "No registramos la llegada a tu turno"
            else:
                paso = f"Marcaste que {quien} no se presentó a \"{turno}\"."
                titulo = "Reofrecimos tu turno como urgente"
            motivo_cierre = f"{quien} no se presentó"
            tipo = NotificationType.SHIFT_REOPENED
        elif motivo is MotivoDesasignacion.CANCELACION:
            paso = (
                f"El trabajador canceló su asignación al turno \"{turno}\" "
                "luego de confirmarla."
            )
            titulo = "El trabajador canceló su asignación"
            motivo_cierre = "la persona confirmada canceló"
            tipo = NotificationType.SHIFT_REOPENED
        elif motivo is None:
            # Suspensión de la cuenta (ADR-0024): no se dice por qué.
            paso = f"La persona asignada a \"{turno}\" ya no puede tomarlo."
            titulo = "Tu turno volvió a buscar personal"
            motivo_cierre = "la persona asignada ya no puede tomarlo"
            tipo = NotificationType.SHIFT_REOPENED
        else:
            paso = f"El trabajador asignado rechazó el turno \"{turno}\"."
            titulo = "Rechazaron un turno"
            motivo_cierre = "la persona asignada lo rechazó"
            tipo = NotificationType.SHIFT_REJECTED

        if outcome is Reapertura.SIN_CUBRIR:
            await self._notify_company(
                shift.company_id,
                NotificationType.SHIFT_NOT_COVERED,
                "Un turno quedó sin cubrir",
                (
                    f"\"{turno}\" quedó sin cubrir: {motivo_cierre} y queda muy "
                    f"poco horario (menos de {format_duracion(REOFFER_MIN_REMAINING + REOFFER_MIN_OFFER_WINDOW)}), "
                    "así que no lo reofrecimos. Podés publicarlo de nuevo."
                ),
            )
        elif outcome is Reapertura.REOFRECIDO:
            await self._notify_company(
                shift.company_id,
                tipo,
                titulo,
                (
                    f"{paso} Como ya había empezado, lo reofrecimos como urgente "
                    f"hasta las {_hora(shift.offered_until)}, dos horas antes de que "
                    f"termine (a las {_hora(shift.end_at)}); se paga lo que reste "
                    "desde que llegue el reemplazo."
                ),
                # Lo que el comercio necesita es elegir a otro: el aviso abre
                # los candidatos de ESE turno.
                link=candidatos,
            )
        else:
            # Todavía no había empezado: el aviso de siempre.
            sigue = (
                "El turno volvió a buscar personal: elegí a otra persona entre "
                "los postulantes."
                if motivo is None
                else "Volvió a buscar personal."
            )
            await self._notify_company(
                shift.company_id,
                tipo,
                titulo,
                f"{paso} {sigue}",
                link=candidatos,
            )

    async def _publication_subscription(self, company_id: UUID, now: datetime) -> Subscription:
        """La suscripción del comercio con la ventana de uso al día. No guarda
        nada: si la ventana venció, la nueva queda en la entidad, y en la base
        la abre recién la publicación que se cuenta
        (`SubscriptionRepository.register_publication`)."""
        # ADR-0022: con el cobro real exigido (`billing_enforced` = tope
        # prendido + credenciales de Mercado Pago) un comercio nuevo arranca
        # `pendiente`. Con el cobro apagado arranca `activa` (la beta).
        subscription = await self._subscriptions.get_or_create(
            company_id,
            initial_status=(
                SubscriptionStatus.PENDIENTE
                if settings.billing_enforced
                else SubscriptionStatus.ACTIVA
            ),
        )
        subscription.roll_period_if_expired(now)
        return subscription

    async def _ensure_publication_allowed(self, company_id: UUID) -> None:
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
        comercios en un escalón pago").

        Sólo consulta: el uso lo suma `_register_publication`, después de que
        la publicación ocurrió."""
        now = datetime.now(timezone.utc)
        subscription = await self._publication_subscription(company_id, now)
        plan = get_plan(subscription.plan_code)
        # ADR-0022: con el cobro real exigido publicar pide además un mes
        # pago vigente. Con el cobro apagado esto no cambia nada.
        if settings.billing_enforced:
            subscription.ensure_paid(now)
        if settings.subscriptions_enforced:
            subscription.ensure_can_publish(plan)

    async def _register_publication(self, company_id: UUID) -> None:
        """Suma al uso del plan un turno que YA quedó publicado. Se llama una
        sola vez por publicación, después de guardar el turno: un intento que
        no publicó nada no llega hasta acá y no cambia el contador. El uso se
        registra también con el tope apagado, para tener el dato cuando se
        encienda."""
        # La suma va en la base (`turnos_usados_mes + 1`), sin leer y
        # reescribir: dos publicaciones a la vez del mismo comercio cuentan
        # las dos (CON-08). La lectura sólo asegura que la suscripción exista.
        now = datetime.now(timezone.utc)
        await self._publication_subscription(company_id, now)
        await self._subscriptions.register_publication(company_id, now)

    async def cancel_shift(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio cancela el turno (terminal, cualquier estado no
        terminal salvo con la salida marcada: ese turno ya se trabajó, se
        finaliza y se paga; U081).

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
        comprometerse.

        A quién se avisa (T3e, ver `_notify_shift_cancelled`): al asignado,
        haya confirmado o no, y a cada persona con la postulación pendiente.
        Primero queda guardado todo lo que cambia (turno, postulaciones,
        contador del comercio) y recién después salen los avisos, que no
        pueden hacer fallar una cancelación que ya está hecha."""
        shift = await self._get_owned(company_id, shift_id)
        return await self._cancel_owned(company_id, shift)

    async def cancel_event(self, company_id: UUID, event_id: UUID) -> list[Shift]:
        """El comercio cancela un evento entero de una vez (U084, decisión de
        Julieta del 2026-11-17): **las mismas reglas que cancelar cada
        puesto**, porque es eso, puesto por puesto. A cada asignado y a cada
        postulación pendiente le llega su aviso, y cada puesto con alguien ya
        comprometido suma su propia cancelación tardía al comercio.

        Los puestos que ya terminaron, se pagaron, quedaron sin cubrir o ya
        estaban cancelados no se tocan; tampoco los que tienen la salida
        marcada (U081: ya se trabajaron, se finalizan y se pagan). Devuelve los que se cancelaron ahora.
        Un evento inexistente o de otro comercio es `ShiftNotFoundError` (no
        se revela cuál de los dos); uno sin nada para cancelar,
        `InvalidShiftTransitionError`.

        Cada puesto se guarda por separado: si algo falla a mitad de camino,
        reintentar cancela los que quedaron (los ya cancelados se saltean)."""
        puestos = await self._shifts.list_by_event(company_id, event_id)
        if not puestos:
            raise ShiftNotFoundError(str(event_id))
        pendientes = [p for p in puestos if p.is_cancellable]
        if not pendientes:
            raise InvalidShiftTransitionError(
                "Este evento ya no tiene puestos para cancelar."
            )
        return [await self._cancel_owned(company_id, puesto) for puesto in pendientes]

    async def _cancel_owned(self, company_id: UUID, shift: Shift) -> Shift:
        """Cancela un turno que ya se sabe del comercio: guarda, rechaza las
        postulaciones pendientes, suma la tardía si correspondía y avisa. Lo
        comparten cancelar un turno y cancelar un evento entero."""
        shift_id = shift.id
        was_committed = shift.status in COMMITTED_STATUSES
        affected_worker_profile_id = shift.worker_profile_id
        shift.cancel()
        updated = await self._shifts.update(shift)
        logger.info(
            "shift.cancelled",
            extra={
                "shift_id": str(updated.id),
                "company_id": str(company_id),
                "was_committed": was_committed,
            },
        )
        applicant_profile_ids = await self._reject_pending_applicants(shift_id)
        if was_committed and affected_worker_profile_id is not None:
            await self._companies.record_late_cancellation(company_id)
        await self._notify_shift_cancelled(
            updated,
            assigned_worker_profile_id=affected_worker_profile_id,
            was_committed=was_committed,
            applicant_profile_ids=applicant_profile_ids,
        )
        return updated

    async def _notify_shift_cancelled(
        self,
        shift: Shift,
        *,
        assigned_worker_profile_id: UUID | None,
        was_committed: bool,
        applicant_profile_ids: list[UUID],
    ) -> None:
        """Avisos de un turno que el comercio acaba de cancelar: una persona,
        un aviso.

        - Asignado que ya había confirmado (cancelación tardía, ADR-0007):
          `SHIFT_CANCELLED_LATE`, como hasta ahora.
        - Asignado que todavía no había confirmado: `SHIFT_CANCELLED`. Antes
          no le llegaba nada y el panel del comercio decía «se le avisa».
        - Cada postulación que estaba pendiente: `APPLIED_SHIFT_CANCELLED`.
          El texto sólo nombra el turno: ni el motivo ni los demás postulantes.

        Quien había quedado afuera al asignarse el turno (postulación ya
        rechazada) no recibe nada: su postulación no estaba viva.

        Nunca propaga: el turno ya quedó cancelado y un error acá (la base
        rechaza el aviso, cae el push) no puede devolverle un 500 al comercio.
        Los dos avisos fallan por separado, y eso descansa en que el adaptador
        de avisos deja la sesión usable cuando su escritura falla
        (`SqlAlchemyNotificationRepository._commit_or_reset`)."""
        name = shift.title or shift.position.label
        try:
            if assigned_worker_profile_id is not None and was_committed:
                await self._notify_worker(
                    assigned_worker_profile_id,
                    NotificationType.SHIFT_CANCELLED_LATE,
                    "El comercio canceló tu turno",
                    (
                        f"\"{name}\" fue cancelado por "
                        "el comercio después de que confirmaste tu asistencia."
                    ),
                )
            elif assigned_worker_profile_id is not None:
                await self._notify_worker(
                    assigned_worker_profile_id,
                    NotificationType.SHIFT_CANCELLED,
                    "El comercio canceló el turno",
                    (
                        f"\"{name}\" se canceló antes de que confirmaras. "
                        "Ya no tenés que responder."
                    ),
                )
        except Exception:
            logger.exception(
                "Aviso de cancelación al asignado: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                shift.id,
            )
        try:
            notices: list[Notification] = []
            already_notified = {assigned_worker_profile_id}
            for profile_id in applicant_profile_ids:
                if profile_id in already_notified:
                    continue
                already_notified.add(profile_id)
                profile = await self._workers.get_by_id(profile_id)
                if profile is None:
                    continue
                notices.append(
                    Notification(
                        user_id=profile.user_id,
                        type=NotificationType.APPLIED_SHIFT_CANCELLED,
                        title="Se canceló un turno al que te postulaste",
                        message=(
                            f"El comercio canceló \"{name}\". Tu postulación "
                            "quedó sin efecto: mirá otros turnos cerca."
                        ),
                    )
                )
            await self._notifications.add_many(notices)
        except Exception:
            logger.exception(
                "Aviso de cancelación a postulantes: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                shift.id,
            )

    async def mark_no_show(
        self, company_id: UUID, shift_id: UUID, *, _trigger: str = "manual"
    ) -> Shift:
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
        pueda ver/disputar el evento.

        `_trigger` distingue en el log de negocio si lo marcó el comercio
        (default, endpoint real) o el scheduler (`auto_mark_no_show`) — no
        es parte del contrato público, sólo etiqueta el evento."""
        shift = await self._get_owned(company_id, shift_id)
        absent_worker_profile_id = shift.worker_profile_id
        outcome = shift.no_show()
        updated = await self._shifts.update(shift)
        logger.info(
            "worker.no_show",
            extra={
                "shift_id": str(updated.id),
                "worker_profile_id": (
                    str(absent_worker_profile_id) if absent_worker_profile_id else None
                ),
                "trigger": _trigger,
            },
        )
        # Una ausencia siempre cae con el turno empezado: se reofrece como
        # urgente o, si quedan menos de 2 horas, pasa a «no cubierto» (U080).
        await self._record_reopen(
            updated,
            outcome,
            left_worker_profile_id=absent_worker_profile_id,
            motivo=MotivoDesasignacion.AUSENCIA,
        )
        if absent_worker_profile_id is not None:
            await self._workers.record_no_show(absent_worker_profile_id)
            nombre = updated.title or updated.position.label
            if _trigger == "automatic":
                # Nadie lo marcó: el sistema no vio su llegada. Se le cuenta
                # como fue (U082/U089) y se le dice cómo reclamar.
                title = "No registramos tu llegada"
                message = (
                    f"No registramos tu llegada al turno \"{nombre}\" y quedó "
                    "como ausencia. Si fue un error, escribinos desde Soporte."
                )
            else:
                title = "Te marcaron como no presentado"
                message = (
                    f"El comercio marcó que no te presentaste al turno "
                    f"\"{nombre}\". Esto impacta tu reputación. "
                    "Si fue un error, escribinos desde Soporte."
                )
            # El aviso tiene un solo destino: el perfil, donde se ve la
            # ausencia. «Soporte» queda como texto, no como segundo link.
            await self._notify_worker(
                absent_worker_profile_id,
                NotificationType.SHIFT_NO_SHOW,
                title,
                message,
                link="/profile",
            )
        # Al comercio, un aviso que le cuenta qué pasó y qué hizo la app con
        # el turno (antes de U080 la ausencia no le avisaba nada); y a quienes
        # están cerca, el turno reofrecido.
        await self._announce_reopen(
            updated,
            outcome,
            left_worker_profile_id=absent_worker_profile_id,
            motivo=MotivoDesasignacion.AUSENCIA,
            automatic=_trigger == "automatic",
        )
        return updated

    async def list_shifts_awaiting_checkin(self) -> list[Shift]:
        """Turnos CONFIRMADO/EN_CAMINO sin check-in, para el scheduler de
        asistencia (ADR-0008). Sin scoping por comercio: lo recorre un
        proceso de sistema, no un request autenticado."""
        return await self._shifts.list_awaiting_checkin()

    async def send_checkin_reminder(self, shift_id: UUID, paso: int = 1) -> Shift:
        """Recordatorio de llegada número `paso` (puntualidad real, ADR-0008
        act. 2026-11-26): 10 minutos antes de la hora en que se espera a la
        persona, a esa hora y 5 minutos después. Lo dispara el scheduler
        (`punctuality.recordatorio_pendiente`). Guarda el paso para no
        repetirlo. Desde el segundo también se le avisa al comercio, una
        sola vez: si la persona no marcó, él dice si llegó."""
        shift = await self.get_shift(shift_id)
        # Entre que el scheduler listó el turno y esta lectura la persona pudo
        # marcar la llegada o dejar el turno: ya no hay a quién recordarle, y
        # escribir el paso le sacaría los recordatorios a quien lo tome después.
        if shift.worker_profile_id is None or shift.status not in (
            ShiftStatus.CONFIRMADO,
            ShiftStatus.EN_CAMINO,
        ):
            return shift
        if shift.checkin_reminder_step >= paso:
            return shift
        avisar_al_comercio = (
            paso >= PASO_AVISO_AL_COMERCIO
            and shift.checkin_reminder_step < PASO_AVISO_AL_COMERCIO
        )
        shift.checkin_reminder_step = paso
        shift.checkin_reminder_sent_at = datetime.now(timezone.utc)
        updated = await self._shifts.update(shift)
        if updated.worker_profile_id is None:
            return updated
        turno = f"\"{updated.title or updated.position.label}\""
        if paso == 1:
            titulo = "Tu turno está por empezar"
            mensaje = f"Cuando entres al local, marcá tu llegada en {turno}."
        elif paso == 2:
            titulo = "Es la hora de tu turno"
            mensaje = f"Si ya estás en el local, marcá tu llegada en {turno}."
        else:
            titulo = "¿Ya llegaste a tu turno?"
            mensaje = (
                f"Todavía no marcaste tu llegada en {turno}. Marcala para que "
                "el comercio sepa que ya estás."
            )
        await self._notify_worker(
            updated.worker_profile_id,
            NotificationType.CHECKIN_REMINDER,
            titulo,
            mensaje,
            # «Llegué» vive en Matches > Asignados (U066).
            link=f"/my-shifts?turno={updated.id}",
        )
        if avisar_al_comercio:
            nombre = await self._worker_name(updated.worker_profile_id) or "La persona asignada"
            await self._notify_company(
                updated.company_id,
                NotificationType.WORKER_NOT_CHECKED_IN,
                f"{nombre} todavía no marcó la llegada",
                (
                    f"Si ya está en el local, tocá «Ya llegó» en el turno {turno}. "
                    "Si no llega, podés marcar «No se presentó» desde «Más»."
                ),
                link=f"/shifts?turno={updated.id}",
            )
        return updated

    async def company_check_in(
        self, company_id: UUID, shift_id: UUID, *, on_time: bool
    ) -> Shift:
        """«Ya llegó»: el comercio marca la llegada de quien no la marcó, y
        dice si fue a horario o tarde (puntualidad real, ADR-0008 act.
        2026-11-26). La persona se entera."""
        shift = await self._get_owned(company_id, shift_id)
        worker_profile_id = shift.worker_profile_id
        shift.company_check_in(on_time)
        updated = await self._shifts.update(shift)
        if worker_profile_id is not None:
            await self._notify_worker(
                worker_profile_id,
                NotificationType.ARRIVAL_MARKED_BY_COMPANY,
                "El comercio marcó tu llegada",
                (
                    f"{await self._shift_name_with_company(updated)}: el comercio indicó que "
                    f"llegaste {'a horario' if on_time else 'tarde'}. Si marcás tu llegada "
                    "vos al entrar, queda registrada tu hora."
                ),
                link=f"/my-shifts?turno={updated.id}",
            )
        return updated

    async def send_departure_reminder(self, shift_id: UUID) -> Shift:
        """Push al trabajador para que avise al comercio cuando sale ("va en
        camino"). Lo dispara el scheduler `DEPARTURE_REMINDER_LEAD` antes del
        inicio de un turno CONFIRMADO. No prende nada solo: compartir la
        ubicación sigue siendo un toque del trabajador, esto sólo le recuerda
        que existe. Idempotente vía `departure_reminder_sent_at`."""
        shift = await self.get_shift(shift_id)
        sent_at = datetime.now(timezone.utc)
        # Marca de sistema: no sube la versión del turno (ADR-0016), así un
        # «Confirmar» con la versión previa no da «El turno cambió».
        claimed = shift.worker_profile_id is not None and (
            await self._shifts.mark_departure_reminder_sent(
                shift.id, shift.worker_profile_id, sent_at
            )
        )
        updated = await self.get_shift(shift_id)
        if claimed and updated.worker_profile_id is not None:
            start_utc = updated.start_at
            if start_utc.tzinfo is None:  # SQLite (tests) devuelve naive, en UTC
                start_utc = start_utc.replace(tzinfo=timezone.utc)
            start = start_utc.astimezone(ARG_TZ)
            await self._notify_worker(
                updated.worker_profile_id,
                NotificationType.DEPARTURE_REMINDER,
                f"Tu turno arranca a las {start:%H:%M}",
                (
                    "Cuando salgas, tocá \"Va en camino\" para que el comercio "
                    "sepa que estás llegando."
                ),
                # «Va en camino» vive en Matches > Asignados (U066).
                link=f"/my-shifts?turno={updated.id}",
            )
        return updated

    # --- Reconfirmación antes del turno (ADR-0031, P3) ----------------------

    def _cuando(self, shift: Shift, ahora: datetime) -> str:
        """`hoy a las 21:00` o `mañana a las 21:00`, en hora argentina."""
        start = shift.start_at
        if start.tzinfo is None:  # SQLite (tests) devuelve naive, en UTC
            start = start.replace(tzinfo=timezone.utc)
        start = start.astimezone(ARG_TZ)
        if ahora.tzinfo is None:
            ahora = ahora.replace(tzinfo=timezone.utc)
        hoy = ahora.astimezone(ARG_TZ).date()
        if start.date() == hoy:
            dia = "hoy"
        elif start.date() == hoy + timedelta(days=1):
            dia = "mañana"
        else:
            dia = f"el {start:%d/%m}"
        return f"{dia} a las {start:%H:%M}"

    async def send_reconfirmation_request(
        self, shift_id: UUID, paso: PasoReconfirmacion
    ) -> Shift:
        """«¿Seguís disponible?» a quien confirmó el turno. Lo dispara el scheduler
        a las 24 y a las 3 horas del inicio (`reconfirmacion.paso_pendiente`).
        Idempotente: la marca del aviso se toma antes de mandarlo."""
        field = (
            "reconfirm_24h_sent_at"
            if paso is PasoReconfirmacion.PRIMER_AVISO
            else "reconfirm_3h_sent_at"
        )
        shift = await self.get_shift(shift_id)
        ahora = datetime.now(timezone.utc)
        claimed = shift.worker_profile_id is not None and (
            await self._shifts.mark_reconfirmation(
                shift.id, shift.worker_profile_id, field, ahora
            )
        )
        updated = await self.get_shift(shift_id)
        if claimed and updated.worker_profile_id is not None:
            company = await self._companies.get_by_id(updated.company_id)
            donde = f" en {company.name}" if company is not None and company.name else ""
            cuando = self._cuando(updated, ahora)
            # Se pregunta por la disponibilidad, no se controla si va a
            # cumplir (consulta legal, 2026-11-26).
            await self._notify_worker(
                updated.worker_profile_id,
                NotificationType.RECONFIRM_REQUEST,
                "¿Seguís disponible para este turno?",
                (
                    f"{cuando[0].upper()}{cuando[1:]}{donde}. Indicá si mantenés tu "
                    "disponibilidad para que el comercio pueda organizarse."
                ),
                link=f"/my-shifts?turno={updated.id}",
            )
        return updated

    async def alert_not_reconfirmed(self, shift_id: UUID) -> Shift:
        """Le avisa al comercio que la persona no contestó si sigue yendo. No
        le saca el turno a nadie: decide el comercio. Lo dispara el scheduler
        2 horas antes del inicio."""
        shift = await self.get_shift(shift_id)
        ahora = datetime.now(timezone.utc)
        worker_profile_id = shift.worker_profile_id
        claimed = worker_profile_id is not None and (
            await self._shifts.mark_reconfirmation(
                shift.id, worker_profile_id, "no_reconfirm_alert_sent_at", ahora
            )
        )
        updated = await self.get_shift(shift_id)
        if claimed and worker_profile_id is not None:
            name = await self._worker_name(worker_profile_id) or "La persona asignada"
            await self._notify_company(
                updated.company_id,
                NotificationType.WORKER_NOT_RECONFIRMED,
                f"Todavía no hay respuesta de {name}",
                (
                    f"Aún no indicó si mantiene su disponibilidad para el turno de "
                    f"{self._cuando(updated, ahora)}. Podés escribirle o decidir cómo seguir."
                ),
                link=f"/shifts?turno={updated.id}",
            )
        return updated

    async def reconfirm(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        """«Sí, sigo disponible»: la persona asignada reconfirma que va. Queda la fecha y
        el comercio lo ve en el turno; no avisa a nadie ni sube la versión."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        if not self._reconfirmacion_activa or shift.status != ShiftStatus.CONFIRMADO:
            raise InvalidShiftTransitionError(no_se_puede("reconfirmar", shift.status))
        # Sólo contesta una pregunta hecha: un «Sí, sigo disponible» anticipado dejaría al
        # comercio sin el aviso de que la persona no contestó después. Sin
        # pregunta pendiente no hace nada (y un reintento no da error).
        if not shift.reconfirmation_pending:
            return shift
        await self._shifts.mark_reconfirmation(
            shift.id,
            worker_profile_id,
            "reconfirmed_at",
            datetime.now(timezone.utc),
            only_once=False,
        )
        return await self.get_shift(shift_id)

    async def auto_mark_no_show(self, shift_id: UUID) -> Shift:
        """Marca no-show automático (ADR-0008): lo dispara el scheduler
        cuando pasó `NO_SHOW_GRACE_PERIOD` desde `start_at` sin check-in.
        Reutiliza `mark_no_show` scopeado al `company_id` real del turno (no
        viene de un request de ese comercio, lo dispara un proceso de
        sistema)."""
        shift = await self.get_shift(shift_id)
        return await self.mark_no_show(shift.company_id, shift.id, _trigger="automatic")

    async def list_shifts_awaiting_coverage_check(self) -> list[Shift]:
        """Turnos PUBLICADO/BUSCANDO_PERSONAL/ASIGNADO cuyo `start_at` ya
        pasó (o está por pasar), para el scheduler de "no cubierto"
        (ADR-0015). Sin scoping por comercio: lo recorre un proceso de
        sistema, igual que `list_shifts_awaiting_checkin`."""
        return await self._shifts.list_awaiting_coverage_check()

    async def mark_not_covered(self, shift_id: UUID) -> Shift:
        """Resuelve automáticamente un turno cuyo período de gracia después
        de `start_at` se agotó sin llegar a CONFIRMADO (ADR-0015).

        Dispara `Shift.mark_not_covered()` (sin reputación, sin reabrir —ver
        su docstring) y avisa SÓLO al comercio: si había alguien asignado sin
        confirmar, no se le manda nada — no hay nada que ese trabajador tenga
        que hacer con esa noticia, el momento ya pasó.

        El scheduler decide llamar con una foto del turno leída antes: si en
        el medio se reofreció (U080), su plazo pasó a `end_at`. Con el turno
        recién leído, si todavía no corresponde (`coverage_deadline`), no se
        hace nada: la próxima pasada decide con el estado nuevo.

        Con la cuenta del comercio suspendida el turno vence igual, pero sin
        ningún aviso (ADR-0024, actualización 2026-11-18)."""
        shift = await self.get_shift(shift_id)
        if _naive(datetime.now(timezone.utc)) < coverage_deadline(shift):
            logger.info(
                "scheduler.skipped",
                extra={"shift_id": str(shift.id), "reason": "coverage_deadline_moved"},
            )
            return shift
        # Una ausencia previa (`no_show_at`, que sólo pone `Shift.no_show()` y
        # nunca se limpia) hace falso decir «nadie confirmó» (U082). El texto de
        # la ausencia vale en todos los caminos: aun si después se asignó a otra
        # persona y no llegó a confirmar o canceló, igual hubo alguien confirmado
        # que no se presentó y no se consiguió reemplazo a tiempo.
        tras_ausencia = shift.no_show_at is not None
        reofrecido = shift.is_reoffered
        # Comercio suspendido (ADR-0024, actualización 2026-11-18): el turno
        # estaba oculto. Vence igual, pero queda marcado (fuera de las métricas
        # de cobertura, también si la cuenta se reactiva) y no se avisa.
        suspendida = not await self.company_account_active(shift.company_id)
        shift.mark_not_covered(company_suspended=suspendida)
        updated = await self._shifts.update(shift)
        logger.info(
            "shift.not_covered",
            extra={
                "shift_id": str(updated.id),
                "company_id": str(updated.company_id),
                "company_suspended": suspendida,
            },
        )
        if suspendida:
            return updated
        nombre = updated.title or updated.position.label
        if reofrecido:
            # U080: se reabrió ya empezado y se ofreció mientras le quedaba
            # horario. Decir «nadie confirmó» sería falso: alguien lo tuvo y
            # lo dejó.
            message = (
                f"\"{nombre}\" quedó sin cubrir: lo reofrecimos como urgente y no "
                "se consiguió reemplazo a tiempo. Podés publicarlo de nuevo."
            )
        elif tras_ausencia:
            message = (
                f"\"{nombre}\" quedó sin cubrir: una "
                "persona confirmada no se presentó y no se consiguió reemplazo a "
                "tiempo. Podés publicarlo de nuevo."
            )
        else:
            message = (
                f"Se agotó el tiempo para cubrir \"{nombre}\" "
                "sin que nadie confirmara. Podés publicarlo de nuevo."
            )
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_NOT_COVERED,
            "Un turno quedó sin cubrir",
            message,
        )
        return updated

    async def assign_worker(
        self, company_id: UUID, shift_id: UUID, worker_profile_id: UUID
    ) -> Shift:
        """El comercio asigna el turno a uno de los candidatos recomendados.

        Este es el momento real de "aceptación" que ve el trabajador (el
        comercio elige a un postulante o asigna directo, ver
        `ApplicationService`): además de la notificación in-app, se le manda
        un email best-effort avisándole (`_send_acceptance_email`).

        Si el trabajador tenía una `ShiftApplication` a este mismo turno
        (PENDIENTE, o DESASIGNADA si ya lo había tenido y lo dejó), pasa a
        ACEPTADA (ver `_accept_application`). Si fue asignado directo
        (búsqueda/mapa, sin postulación previa) no hay nada que actualizar y
        no falla. Los demás postulantes del turno pasan a RECHAZADA
        (`_reject_pending_applicants`, TECH_DEBT P5): antes su postulación
        quedaba "pendiente" para siempre aunque ya no tuvieran chance. Si el
        turno se reabre (el asignado rechaza/cancela/no-show), esos rechazos se
        revierten (`_restore_rejected_applicants`)."""
        shift = await self._get_owned(company_id, shift_id)
        # Un perfil inexistente antes terminaba en error de FK (500).
        profile = await self._workers.get_by_id(worker_profile_id)
        if profile is None:
            raise AssigneeNotFoundError()
        # Primero el turno: si no admite la asignación, el error es el de
        # siempre y no depende de quién sea la persona (si no, el 409 de
        # abajo le diría al comercio que esa cuenta está suspendida sin que
        # pase nada: no-disclosure). `assign` lo vuelve a exigir.
        if not shift.admits_assignment:
            shift.assign(worker_profile_id)
        # Cuenta suspendida (ADR-0024): no podría entrar a confirmar y el
        # turno quedaría «Esperando que confirme» para siempre. Se corta acá,
        # antes de tocar el turno y a los demás postulantes.
        user = await self._users.get_by_id(profile.user_id)
        if user is None or not user.is_active:
            raise AssigneeUnavailableError()
        shift.assign(worker_profile_id)
        updated = await self._shifts.update(shift)
        logger.info(
            "shift.assigned",
            extra={
                "shift_id": str(updated.id),
                "worker_profile_id": str(worker_profile_id),
                "company_id": str(company_id),
            },
        )
        await self._accept_application(shift_id, worker_profile_id)
        await self._reject_pending_applicants(shift_id)
        await self._notify_worker(
            worker_profile_id,
            NotificationType.SHIFT_ASSIGNED,
            "Te asignaron un turno",
            f"Te asignaron el turno \"{updated.title or updated.position.label}\". Confirmá tu asistencia.",
        )
        await self._send_acceptance_email(worker_profile_id, updated)
        return updated

    async def _accept_application(self, shift_id: UUID, worker_profile_id: UUID) -> None:
        """Marca ACEPTADA la postulación de este trabajador a este turno, si
        existe (asignación directa sin postulación previa no tiene nada que
        actualizar acá). Vale para la PENDIENTE, para la DESASIGNADA (el
        comercio vuelve a elegir a quien había rechazado, cancelado o faltado)
        y para la RETIRADA (lo asigna igual, desde «Recomendados»)."""
        application = await self._applications.get_by_shift_and_worker(
            shift_id, worker_profile_id
        )
        if application is None or application.status not in ASSIGNABLE_FROM:
            return
        application.accept()
        await self._applications.update(application)
        logger.info(
            "application.accepted",
            extra={"shift_id": str(shift_id), "worker_profile_id": str(worker_profile_id)},
        )

    async def _reject_pending_applicants(self, shift_id: UUID) -> list[UUID]:
        """Marca RECHAZADA las postulaciones PENDIENTE que quedan en un turno
        que dejó de estar abierto (se asignó a alguien, o el comercio lo
        canceló): antes quedaban 'pendiente' para siempre (TECH_DEBT P5).

        La del elegido ya pasó a ACEPTADA en `_accept_application` (o nunca
        existió, si fue asignación directa), así que el filtro por PENDIENTE
        nunca la toca: sólo caen los NO elegidos. No se notifica al perdedor a
        propósito (evita un mensaje desalentador que además sería erróneo si el
        turno se reabre; la corrección es sólo de estado para que no quede
        'esperando respuesta' eterno).

        Devuelve los perfiles cuya postulación acaba de rechazar: al cancelar
        el turno sí se les avisa (`_notify_shift_cancelled`), porque un turno
        cancelado no se reabre."""
        rejected_profile_ids: list[UUID] = []
        for application in await self._applications.list_by_shift(shift_id):
            if application.status == ApplicationStatus.PENDIENTE:
                application.reject()
                await self._applications.update(application)
                rejected_profile_ids.append(application.worker_profile_id)
        rejected_count = len(rejected_profile_ids)
        if rejected_count:
            # Un solo log agregado (no uno por postulante rechazado): son
            # rechazos automáticos del mismo evento (se cubrió el turno),
            # no decisiones individuales que valga la pena narrar una por una.
            logger.info(
                "application.rejected",
                extra={"shift_id": str(shift_id), "count": rejected_count},
            )
        return rejected_profile_ids

    async def _mark_unassigned(
        self, shift_id: UUID, worker_profile_id: UUID, motivo: MotivoDesasignacion
    ) -> None:
        """Deja escrito que quien tenía el turno lo dejó, y por qué (G4): su
        postulación pasa a DESASIGNADA con el motivo. El comercio la sigue
        viendo, al final de los postulantes y con su marca, y puede volver a
        asignarle el turno.

        Si la persona fue asignada sin haberse postulado no había fila: se
        crea, ya DESASIGNADA. Antes la postulación quedaba ACEPTADA para
        siempre y nada registraba el rechazo, la cancelación ni la ausencia.

        El turno ya se reabrió cuando se llega acá: si esto falla se registra
        y no se propaga (se pierde la marca, no la reapertura). Se intenta dos
        veces: si entre leer y escribir otro pedido creó la fila (la persona
        se postuló justo), la segunda vuelta la encuentra y la marca."""
        for attempt in (1, 2):
            try:
                if await self._write_unassigned(shift_id, worker_profile_id, motivo):
                    logger.info(
                        "application.unassigned",
                        extra={
                            "shift_id": str(shift_id),
                            "worker_profile_id": str(worker_profile_id),
                            "motivo": motivo.value,
                        },
                    )
                return
            except Exception:
                logger.exception(
                    "No se pudo marcar la desasignación (shift_id=%s, motivo=%s, intento=%s)",
                    shift_id,
                    motivo.value,
                    attempt,
                )

    async def _write_unassigned(
        self, shift_id: UUID, worker_profile_id: UUID, motivo: MotivoDesasignacion
    ) -> bool:
        """Una vuelta de `_mark_unassigned`. Devuelve si dejó la marca."""
        # El turno se guardó reabierto antes de llegar acá. Si en ese hueco el
        # comercio volvió a asignar a la misma persona, hoy lo tiene: marcarla
        # la dejaría «desasignada» con el turno en la mano.
        shift = await self._shifts.get_by_id(shift_id)
        if shift is not None and shift.worker_profile_id == worker_profile_id:
            return False
        application = await self._applications.get_by_shift_and_worker(
            shift_id, worker_profile_id
        )
        if application is None:
            await self._applications.add(
                ShiftApplication.unassigned(shift_id, worker_profile_id, motivo)
            )
            return True
        if application.status in ASSIGNABLE_FROM:
            # No estaba ACEPTADA: una fila de antes de la migración 0051 (se
            # la asignó sin tocar su postulación), o se postuló en el hueco
            # entre que el turno se reabrió y esta escritura.
            application.accept()
        if application.status != ApplicationStatus.ACEPTADA:
            logger.warning(
                "application.unassign_skipped",
                extra={
                    "shift_id": str(shift_id),
                    "worker_profile_id": str(worker_profile_id),
                    "status": application.status.value,
                },
            )
            return False
        application.unassign(motivo)
        await self._applications.update(application)
        return True

    async def _release_application(self, shift_id: UUID, worker_profile_id: UUID) -> None:
        """La postulación ACEPTADA de quien perdió el turno por la suspensión
        de su cuenta vuelve a PENDIENTE, sin marca (ADR-0024): no fue una
        decisión suya. Mientras siga suspendida la lista no la muestra."""
        application = await self._applications.get_by_shift_and_worker(
            shift_id, worker_profile_id
        )
        if application is None or application.status != ApplicationStatus.ACEPTADA:
            return
        application.release()
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
        persistida. Ver contrato de `EmailSender`.

        Con `run_after_response` el envío sale después de responder
        (2026-10-23): el comercio ya no espera al proveedor de email."""
        try:
            profile = await self._workers.get_by_id(worker_profile_id)
            if profile is None:
                return
            user = await self._users.get_by_id(profile.user_id)
            if user is None:
                return
            company = await self._companies.get_by_id(shift.company_id)
            company_name = (company.name if company is not None else None) or "Un comercio"
            position_label = shift.position.label
            subject = f"Te aceptaron: {position_label} en {company_name}"
            html = render_shift_accepted_email_html(
                user.full_name,
                position_label,
                company_name,
                format_turno_art(shift.start_at, shift.end_at),
                f"{settings.frontend_url}/my-shifts",
            )
        except Exception:
            logger.exception(
                "No se pudo armar el email de aceptación de turno al trabajador %s",
                worker_profile_id,
            )
            return
        # Las lecturas de arriba usan la sesión del request y van antes de
        # responder; el envío (red, hasta 10 s) va después, si se puede.
        if self._run_after_response is not None:
            self._run_after_response(
                self._deliver_acceptance_email, worker_profile_id, user.email, subject, html
            )
        else:
            await self._deliver_acceptance_email(worker_profile_id, user.email, subject, html)

    async def _deliver_acceptance_email(
        self, worker_profile_id: UUID, to: str, subject: str, html: str
    ) -> None:
        """El envío en sí. Atrapa todo: corriendo después de la respuesta, una
        excepción acá ya no tiene a quién llegar más que al log."""
        try:
            await self._email_sender.send(to=to, subject=subject, html=html)
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
        # Dos confirmaciones a la vez de turnos que se superponen (dos
        # dispositivos) leían las dos «ninguno comprometido» y guardaban las
        # dos: la versión del turno no frena nada, son filas distintas (CON-11).
        # Se serializan por persona: la segunda espera acá a que la primera
        # confirme y recién entonces lee los comprometidos.
        await self._workers.lock_agenda(worker_profile_id)
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
            f"El trabajador asignado confirmó su asistencia al turno \"{updated.title or updated.position.label}\".",
        )
        await self._withdraw_overlapping_applications(worker_profile_id, updated)
        # Nuevas deadlines: recordatorio de salida, de check-in y no-show
        # alrededor del `start_at` del turno recién confirmado. Despierta al scheduler para
        # que las agende (ver `scheduler_signal.py`).
        notify_scheduler()
        return updated

    async def _withdraw_overlapping_applications(
        self, worker_profile_id: UUID, confirmed_shift: Shift
    ) -> None:
        """Retira (RETIRADA) las postulaciones PENDIENTE del trabajador cuyo
        turno se solapa con el que acaba de confirmar (no puede trabajarlas),
        y le avisa una sola vez cuáles fueron y por qué (U123): antes
        desaparecían de «Postulaciones» sin ninguna explicación."""
        pending = await self._applications.list_pending_by_worker(worker_profile_id)
        withdrawn: list[Shift] = []
        for application in pending:
            if application.shift_id == confirmed_shift.id:
                continue
            other_shift = await self._shifts.get_by_id(application.shift_id)
            if other_shift is None or not confirmed_shift.overlaps(other_shift):
                continue
            application.withdraw()
            await self._applications.update(application)
            withdrawn.append(other_shift)
        if not withdrawn:
            return
        try:
            await self._notify_withdrawn_applications(
                worker_profile_id, confirmed_shift, withdrawn
            )
        except Exception:
            # El turno ya quedó confirmado y las postulaciones retiradas: que
            # falle el aviso no puede hacer fallar la confirmación.
            logger.exception(
                "Aviso de postulaciones retiradas: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                confirmed_shift.id,
            )

    async def _notify_withdrawn_applications(
        self, worker_profile_id: UUID, confirmed_shift: Shift, withdrawn: list[Shift]
    ) -> None:
        """Un solo aviso por confirmación, con los turnos nombrados (hasta
        tres; el resto, contado)."""
        named = [await self._shift_name_with_company(s) for s in withdrawn[:_MAX_NAMED_SHIFTS]]
        rest = len(withdrawn) - len(named)
        if rest:
            named.append(f"{rest} más")
        listed = named[0] if len(named) == 1 else f"{', '.join(named[:-1])} y {named[-1]}"
        confirmed_name = confirmed_shift.title or confirmed_shift.position.label
        if len(withdrawn) == 1:
            title = "Retiramos una postulación"
            what = f"retiramos tu postulación a {listed}, que es en el mismo horario"
        else:
            title = f"Retiramos {len(withdrawn)} postulaciones"
            what = f"retiramos tus postulaciones a turnos del mismo horario: {listed}"
        await self._notify_worker(
            worker_profile_id,
            NotificationType.APPLICATIONS_WITHDRAWN,
            title,
            (
                f"Confirmaste \"{confirmed_name}\", así que {what}. "
                "Si el turno confirmado se cae, podés volver a postularte."
            ),
            link="/my-shifts",
        )

    async def _shift_name_with_company(self, shift: Shift) -> str:
        """`"Mozo" en La Esquina`: dos turnos del mismo puesto se distinguen
        por el comercio."""
        name = f"\"{shift.title or shift.position.label}\""
        company = await self._companies.get_by_id(shift.company_id)
        return f"{name} en {company.name}" if company is not None and company.name else name

    async def reject_assignment(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> Shift:
        """El trabajador asignado rechaza el turno; vuelve a buscar personal."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        outcome = shift.reject()
        updated = await self._shifts.update(shift)
        await self._record_reopen(
            updated,
            outcome,
            left_worker_profile_id=worker_profile_id,
            motivo=MotivoDesasignacion.RECHAZO,
        )
        await self._announce_reopen(
            updated,
            outcome,
            left_worker_profile_id=worker_profile_id,
            motivo=MotivoDesasignacion.RECHAZO,
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
        # Avisar con tiempo no pesa (ADR-0031, decisión 1): la cancelación
        # queda registrada en la postulación, pero no suma al contador de la
        # persona. Se decide antes de reabrir, que borra las marcas.
        # Vale siempre, con la reconfirmación prendida o apagada (2026-11-26):
        # los Términos dicen que pesa cancelar «muy sobre la hora», no avisar
        # con días.
        sin_peso = cancelacion_sin_peso(shift, datetime.now(timezone.utc))
        outcome = shift.worker_cancel()
        updated = await self._shifts.update(shift)
        await self._record_reopen(
            updated,
            outcome,
            left_worker_profile_id=worker_profile_id,
            motivo=MotivoDesasignacion.CANCELACION,
        )
        if sin_peso:
            logger.info(
                "shift.worker_cancelled_with_notice",
                extra={"shift_id": str(updated.id), "company_id": str(updated.company_id)},
            )
        else:
            await self._workers.record_cancellation(worker_profile_id)
        await self._announce_reopen(
            updated,
            outcome,
            left_worker_profile_id=worker_profile_id,
            motivo=MotivoDesasignacion.CANCELACION,
        )
        return updated

    # --- Suspensión de una cuenta (ADR-0024) ---------------------------------

    async def company_account_active(self, company_id: UUID) -> bool:
        """¿La cuenta dueña de este comercio está activa? Con la cuenta
        suspendida, sus turnos no se muestran a quien no es parte (ADR-0024)."""
        company = await self._companies.get_by_id(company_id)
        if company is None:
            return False
        user = await self._users.get_by_id(company.user_id)
        return user is not None and user.is_active

    async def _worker_account_active(self, worker_profile_id: UUID | None) -> bool:
        """¿La cuenta de este trabajador está activa? El equivalente de
        `company_account_active`. Sin nadie asignado no hay en nombre de
        quién actuar: cuenta como activa."""
        if worker_profile_id is None:
            return True
        profile = await self._workers.get_by_id(worker_profile_id)
        if profile is None:
            return False
        user = await self._users.get_by_id(profile.user_id)
        return user is not None and user.is_active

    async def admin_close_plans(self, shifts: list[Shift]) -> dict[UUID, AdminClosePlan]:
        """Para la ficha de la admin: en qué turnos aplica «Cerrar turno» y
        qué haría (decisión 21). Sólo consulta las cuentas de los turnos que
        ya empezaron; la regla es `Shift.admin_close_plan`."""
        now = datetime.now(timezone.utc)
        plans: dict[UUID, AdminClosePlan] = {}
        for shift in shifts:
            if shift.status not in (
                ShiftStatus.CHECK_IN,
                ShiftStatus.TRABAJANDO,
                ShiftStatus.CHECK_OUT,
            ):
                continue
            try:
                plans[shift.id] = shift.admin_close_plan(
                    worker_active=await self._worker_account_active(shift.worker_profile_id),
                    company_active=await self.company_account_active(shift.company_id),
                    now=now,
                )
            except AdminCloseNotAllowedError:
                continue
        return plans

    async def close_for_suspended_account(
        self,
        admin_user_id: UUID,
        shift_id: UUID,
        expected: tuple[bool, bool] | None = None,
    ) -> AdminCloseResult:
        """«Cerrar turno» de la admin (decisión 21, ADR-0024): un turno ya
        empezado de una cuenta suspendida no se toca al suspender, pero esa
        parte ya no puede entrar a marcar la salida o a cerrarlo. La admin lo
        hace en su nombre, con registro en el turno (`closed_by_admin_*`):

        - trabajador suspendido: marca la salida (sin ubicación, con la hora
          de ahora) y le avisa al comercio que ya puede cerrar;
        - comercio suspendido: cierra el turno con los mismos efectos que
          `finish` (reputación y aviso al trabajador para calificar);
        - los dos: las dos cosas, sin avisos.

        `expected` es lo que confirmó la admin en el diálogo: si el plan de
        ahora es otro, 409 sin tocar nada. A la cuenta suspendida no se le
        avisa nada. No marca pagado. Si el
        trabajador o el comercio actuaron en el medio, el guardado con versión
        (ADR-0016) lo frena antes de cualquier efecto."""
        shift = await self.get_shift(shift_id)
        worker_profile_id = shift.worker_profile_id
        plan = shift.close_for_suspended_account(
            admin_user_id,
            worker_active=await self._worker_account_active(worker_profile_id),
            company_active=await self.company_account_active(shift.company_id),
            expected=expected,
        )
        if plan.finish:
            updated = await self._save_finished(shift)
        else:
            updated = await self._shifts.update(shift)
        logger.info(
            "shift.closed_by_admin",
            extra={
                "shift_id": str(updated.id),
                "admin_user_id": str(admin_user_id),
                "check_out": plan.check_out,
                "finish": plan.finish,
            },
        )
        if plan.notifies == "company" and updated.check_out_at is not None:
            await self._notify_company_admin_check_out(updated, worker_profile_id)
        return AdminCloseResult(shift=updated, plan=plan)

    async def _notify_company_admin_check_out(
        self, shift: Shift, worker_profile_id: UUID | None
    ) -> None:
        """Al comercio, cuando Oído marcó la salida de su trabajador
        suspendido: ya puede cerrar el turno. Best-effort: el turno ya quedó
        guardado."""
        name = "la persona asignada"
        if worker_profile_id is not None:
            worker = await self._workers.get_by_id(worker_profile_id)
            if worker is not None:
                user = await self._users.get_by_id(worker.user_id)
                if user is not None and user.full_name:
                    name = user.full_name
        assert shift.check_out_at is not None
        # La hora sola, sin «hoy»: el aviso se lee después, quizás otro día, y
        # la app ya muestra cuándo llegó.
        cuando = f"a las {to_art(shift.check_out_at):%H:%M}"
        try:
            await self._notify_company(
                shift.company_id,
                NotificationType.SHIFT_CHECKED_OUT,
                "Marcamos la salida de un turno",
                (
                    f"Oído marcó la salida de {name} en "
                    f"\"{shift.title or shift.position.label}\" {cuando}, "
                    "porque no pudo marcarla. Ya podés cerrar el turno."
                ),
                link="/shifts",
            )
        except Exception:
            logger.exception(
                "Aviso de salida marcada por la admin: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                shift.id,
            )

    async def preview_account_suspension(self, user_id: UUID) -> SuspensionImpact:
        """Cuántos turnos tocaría suspender esta cuenta, sin cambiar nada. Lo
        ve la admin antes de confirmar (ADR-0024, punto 4)."""
        impact = SuspensionImpact()
        company = await self._companies.get_by_user_id(user_id)
        if company is not None:
            open_shifts = await self._shifts.list_by_company_and_statuses(
                company.id, OPEN_STATUSES
            )
            taken = await self._shifts.list_by_company_and_statuses(
                company.id, TAKEN_NOT_STARTED_STATUSES
            )
            now = datetime.now(timezone.utc)
            hidden = shifts_hidden_by_company_suspension(open_shifts, now)
            impact += SuspensionImpact(
                hidden=len(hidden), cancelled=len(shifts_taken_not_started(taken, now))
            )
        worker = await self._workers.get_by_user_id(user_id)
        if worker is not None:
            taken = await self._shifts.list_by_worker_and_statuses(
                worker.id, TAKEN_NOT_STARTED_STATUSES
            )
            impact += SuspensionImpact(
                reopened=len(shifts_taken_not_started(taken, datetime.now(timezone.utc)))
            )
        return impact

    async def apply_account_suspension(self, user_id: UUID) -> SuspensionImpact:
        """Lo que la suspensión le hace a los turnos de esta cuenta (ADR-0024).

        - Comercio: los turnos con alguien asignado o confirmado que no
          empezaron se cancelan, con aviso a esa persona y sin cancelación
          tardía. Los abiertos no se tocan: se ocultan solos mientras la
          cuenta no esté activa (`ids_with_inactive_account`).
        - Trabajador: sus turnos asignados o confirmados que no empezaron se
          reabren, con aviso al comercio y sin sumarle una cancelación.

        La admin lo llama antes de marcar la cuenta como suspendida y otra
        vez después (`AdminService.suspend_user`). Cada turno se guarda por separado,
        como en el resto de los casos de uso; si uno falla, la cuenta queda
        sin suspender y la admin puede repetir: los turnos ya resueltos no
        vuelven a entrar (ya no están en esos estados) y siguen los que
        faltaban. Los avisos no hacen fallar nada."""
        hidden_count = (await self.preview_account_suspension(user_id)).hidden
        cancelled = 0
        reopened = 0
        company = await self._companies.get_by_user_id(user_id)
        if company is not None:
            taken = await self._shifts.list_by_company_and_statuses(
                company.id, TAKEN_NOT_STARTED_STATUSES
            )
            for shift in shifts_taken_not_started(taken, datetime.now(timezone.utc)):
                await self._cancel_for_company_suspension(shift)
                cancelled += 1
        worker = await self._workers.get_by_user_id(user_id)
        if worker is not None:
            taken = await self._shifts.list_by_worker_and_statuses(
                worker.id, TAKEN_NOT_STARTED_STATUSES
            )
            for shift in shifts_taken_not_started(taken, datetime.now(timezone.utc)):
                await self._reopen_for_worker_suspension(shift)
                reopened += 1
            # Los que quedaron a medias en un intento anterior: el turno ya se
            # reabrió pero falló la cola (restaurar rechazados, soltar la
            # postulación, avisar). Se repite la cola, que es idempotente.
            await self._finish_half_reopened(worker.id)
        return SuspensionImpact(hidden=hidden_count, cancelled=cancelled, reopened=reopened)

    async def _cancel_for_company_suspension(self, shift: Shift) -> None:
        """Cancela un turno tomado de un comercio suspendido. A diferencia de
        `cancel_shift`, no es cancelación tardía: no la decidió el comercio
        (no se llama a `record_late_cancellation`)."""
        assigned = shift.worker_profile_id
        shift.cancel()
        updated = await self._shifts.update(shift)
        logger.info(
            "shift.cancelled_by_suspension",
            extra={"shift_id": str(updated.id), "company_id": str(updated.company_id)},
        )
        if assigned is None:
            return
        name = updated.title or updated.position.label
        try:
            await self._notify_worker(
                assigned,
                NotificationType.SHIFT_CANCELLED,
                "Se canceló un turno tuyo",
                (
                    f"\"{name}\" se canceló. Ya no tenés que ir ni responder, y "
                    "no cuenta en tu reputación. Mirá otros turnos cerca."
                ),
                link="/feed",
            )
        except Exception:
            logger.exception(
                "Aviso de turno cancelado por suspensión: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                updated.id,
            )

    async def _finish_half_reopened(self, worker_profile_id: UUID) -> None:
        """Repite la cola de la reapertura para los turnos que esta persona
        soltó a medias: su postulación sigue ACEPTADA pero el turno ya está
        abierto y ya no la tiene asignada. Sin esto, si la reapertura fallaba
        después de guardar el turno, la repetición no lo veía entre los
        tomados y los postulantes rechazados quedaban así para siempre."""
        accepted = [
            a
            for a in await self._applications.list_by_worker(
                worker_profile_id, limit=500
            )
            if a.status == ApplicationStatus.ACEPTADA
        ]
        if not accepted:
            return
        shifts = await self._shifts.list_by_ids([a.shift_id for a in accepted])
        by_id = {s.id: s for s in shifts}
        for application in accepted:
            shift = by_id.get(application.shift_id)
            if (
                shift is None
                or shift.status not in OPEN_STATUSES
                or shift.worker_profile_id == worker_profile_id
            ):
                continue
            await self._finish_reopen(shift, worker_profile_id)

    async def _reopen_for_worker_suspension(self, shift: Shift) -> None:
        """Reabre un turno de un trabajador suspendido, como `worker_cancel`
        (vuelve a buscar personal y los demás postulantes vuelven a estar en
        carrera), pero sin `record_cancellation`: la medida es la
        suspensión, no una cancelación suya.

        Hoy sólo llegan acá turnos que no empezaron (`shifts_taken_not_started`,
        ADR-0024 punto 3: lo empezado no se toca), así que el resultado es
        siempre `ABIERTO`. Igual se respeta lo que decida `release_worker`
        (U080) por si eso cambia: reofrecido, con el mismo aviso que el resto
        de las reaperturas; sin cubrir, sin devolver a nadie a la carrera."""
        released_worker_profile_id = shift.worker_profile_id
        outcome = shift.release_worker()
        updated = await self._shifts.update(shift)
        logger.info(
            "shift.reopened_by_suspension",
            extra={
                "shift_id": str(updated.id),
                "company_id": str(updated.company_id),
                "outcome": outcome.value,
            },
        )
        await self._finish_reopen(updated, released_worker_profile_id, outcome)

    async def _finish_reopen(
        self,
        updated: Shift,
        released_worker_profile_id: UUID | None,
        outcome: Reapertura = Reapertura.ABIERTO,
    ) -> None:
        """La cola de reabrir por suspensión, con el turno ya guardado:
        restaurar a los rechazados (salvo que haya quedado sin cubrir: ya no
        hay carrera), soltar la postulación de quien perdió el turno y avisar
        (`_announce_reopen`, el mismo aviso que el resto de las reaperturas).
        Un fallo al restaurar se registra y NO impide el aviso; en ese caso la
        postulación sigue ACEPTADA a propósito, para que
        `_finish_half_reopened` lo reintente en la repetición de la
        suspensión (ese reintento pasa `ABIERTO`: el turno ya está abierto y
        el aviso a quienes están cerca, si correspondía, ya salió)."""
        try:
            if outcome is not Reapertura.SIN_CUBRIR:
                await self._restore_rejected_applicants(updated.id)
            if released_worker_profile_id is not None:
                await self._release_application(updated.id, released_worker_profile_id)
        except Exception:
            logger.exception(
                "Reabrir por suspensión: no se pudo restaurar a los postulantes, "
                "se reintenta al repetir la suspensión (shift_id=%s)",
                updated.id,
            )
        try:
            await self._announce_reopen(
                updated,
                outcome,
                left_worker_profile_id=released_worker_profile_id,
                motivo=None,
            )
        except Exception:
            logger.exception(
                "Aviso de turno reabierto por suspensión: fallo inesperado, no se "
                "propaga (shift_id=%s)",
                updated.id,
            )

    async def depart(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        """El trabajador asignado marca que salió hacia el turno."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.depart()
        return await self._shifts.update(shift)

    async def report_en_route_location(
        self, worker_profile_id: UUID, shift_id: UUID, latitude: float, longitude: float
    ) -> Shift:
        """El trabajador comparte dónde está mientras viaja al turno.

        `_get_assigned_to` hace de guard de autorización: sólo el trabajador
        asignado a ESE turno puede reportar, y un tercero recibe 404 en vez de
        403 (no-disclosure, mismo criterio que el resto del módulo). Cuándo se
        acepta el reporte y cuándo se borra el dato son reglas de la entidad,
        no de acá.

        Avisa al comercio UNA sola vez, en el primer reporte del viaje ("salió
        para tu local"): los siguientes son periódicos mientras viaja, y un
        push por cada uno sería inusable. Después lo ve en el mapa del panel,
        que se refresca solo. Si el trabajador apaga y vuelve a prender, no se
        repite: `en_route_announced_at` sigue puesto hasta que llega o se lo
        desasigna (apagar borra la posición, no el aviso ya mandado).
        """
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        first_report = shift.en_route_announced_at is None
        shift.report_en_route_location(latitude, longitude)
        if first_report:
            shift.en_route_announced_at = shift.en_route_at
        updated = await self._shifts.update(shift)
        if first_report:
            await self._notify_company_worker_left(updated, worker_profile_id)
        return updated

    async def stop_en_route(self, worker_profile_id: UUID, shift_id: UUID) -> Shift:
        """El trabajador deja de compartir su ubicación: se borra en el
        momento, también para el comercio (U072, `Shift.stop_en_route`).

        Mismo guard que el reporte: sólo quien tiene el turno asignado; un
        tercero recibe 404. Apagar sin estar compartiendo no es un error y no
        escribe nada. Al comercio no se le manda un aviso: «dejó de compartir»
        no le pide hacer nada, y lo ve en el panel."""
        # Un reporte periódico puede estar escribiendo el turno en el mismo
        # momento. Apagar tiene que ganar: si choca, se relee y se repite (el
        # 409 dejaría la posición guardada con la persona creyendo que no).
        for attempt in range(_STOP_EN_ROUTE_ATTEMPTS):
            shift = await self._get_assigned_to(worker_profile_id, shift_id)
            if not shift.stop_en_route():
                return shift
            try:
                updated = await self._shifts.update(shift)
            except ShiftConcurrentModificationError:
                if attempt == _STOP_EN_ROUTE_ATTEMPTS - 1:
                    raise
                continue
            logger.info("shift.en_route_stopped", extra={"shift_id": str(updated.id)})
            return updated
        raise AssertionError("inalcanzable")  # pragma: no cover

    async def _notify_company_worker_left(
        self, shift: Shift, worker_profile_id: UUID
    ) -> None:
        name = "Tu trabajador"
        worker = await self._workers.get_by_id(worker_profile_id)
        if worker is not None:
            user = await self._users.get_by_id(worker.user_id)
            if user is not None and user.full_name:
                name = user.full_name
        distance = haversine_km(
            shift.en_route_latitude, shift.en_route_longitude, shift.latitude, shift.longitude
        )
        # La distancia es en línea recta, igual que en el mapa: se redondea
        # para no fingir una precisión que no tiene.
        if distance is None:
            where = "Ya está en viaje"
        elif distance < 1:
            where = "Está a menos de 1 km"
        else:
            where = f"Está a {distance:.1f} km".replace(".", ",")
        await self._notify_company(
            shift.company_id,
            NotificationType.WORKER_EN_ROUTE,
            f"{name} salió para tu local",
            f"{where}. Seguilo en el turno \"{shift.title or shift.position.label}\".",
        )

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
            f"El trabajador terminó el turno \"{updated.title or updated.position.label}\".",
        )
        return updated

    async def finish(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio cierra el turno trabajado.

        R2.4: al finalizar con éxito (el turno sólo llega acá habiendo pasado
        por check-in y check-out, ver `Shift._transition`) se actualizan las
        métricas de reputación reales del trabajador asignado; los efectos
        viven en `_save_finished`, compartidos con `auto_finish`.
        """
        shift = await self._get_owned(company_id, shift_id)
        shift.finish()
        return await self._save_finished(shift, automatic=False)

    async def list_shifts_awaiting_finish(self) -> list[Shift]:
        """Turnos CHECK_OUT (salida marcada, sin cerrar), para el chequeo de
        cierre automático del scheduler (decisión 24). Sin scoping por
        comercio: lo recorre un proceso de sistema."""
        return await self._shifts.list_awaiting_finish()

    async def send_finish_reminder(self, shift_id: UUID) -> Shift:
        """Le recuerda al comercio que cierre un turno con la salida marcada
        (decisión 24): lo dispara el scheduler a `FINISH_REMINDER_DELAY` de
        `check_out_at`. Marca de sistema reclamada con un UPDATE condicional
        (no sube la versión, ADR-0016): dos pasadas no mandan dos avisos. Con
        la cuenta del comercio suspendida la marca se pone igual, pero no se
        le avisa nada (ADR-0024)."""
        claimed = await self._shifts.mark_finish_reminder_sent(
            shift_id, datetime.now(timezone.utc)
        )
        updated = await self.get_shift(shift_id)
        if (
            claimed
            and updated.check_out_at is not None
            and await self.company_account_active(updated.company_id)
        ):
            # La fecha real de la salida, no «hace un día»: la pasada puede
            # llegar tarde (primer despliegue, Render dormido).
            now = datetime.now(timezone.utc)
            checked_out = format_inicio_art(updated.check_out_at, now)
            closes_at = format_inicio_art(updated.check_out_at + AUTO_FINISH_DELAY, now)
            # El pago registrado después de `PAYMENT_TOLERANCE` desde el fin
            # cuenta como tardío (`_was_paid_on_time`): se dice antes de que
            # pase, con la fecha (Julieta, 2026-11-18).
            paid_on_time_until = updated.end_at + PAYMENT_TOLERANCE
            if _naive(now) < _naive(paid_on_time_until):
                pago = (
                    "Para que cuente como pago a tiempo, registralo hasta "
                    f"{format_inicio_art(paid_on_time_until, now)}."
                )
            else:
                pago = "Si registrás el pago ahora, ya cuenta como pago tardío."
            await self._notify_company(
                updated.company_id,
                NotificationType.SHIFT_FINISH_REMINDER,
                "Te falta cerrar un turno",
                (
                    f"La persona marcó la salida de \"{updated.title or updated.position.label}\" "
                    f"{checked_out}. Cerralo para poder calificarla y registrar el pago. "
                    f"{pago} Si no lo cerrás, se cierra solo {closes_at}."
                ),
                link="/shifts",
            )
        return updated

    async def auto_finish(self, shift_id: UUID) -> Shift:
        """Oído cierra solo el turno que el comercio no cerró (decisión 24):
        lo dispara el scheduler a `AUTO_FINISH_DELAY` de `check_out_at`.
        Mismos efectos que `finish` (`_save_finished`), con su propio aviso
        al trabajador, y además le avisa al comercio, salvo cuenta suspendida.

        Si el comercio cierra en el mismo instante gana uno solo: el guardado
        con versión (ADR-0016) hace que el otro falle antes de cualquier
        efecto (`ShiftConcurrentModificationError`, o
        `InvalidShiftTransitionError` si ya lo leyó cerrado); el scheduler lo
        saltea."""
        shift = await self.get_shift(shift_id)
        shift.auto_finish()
        updated = await self._save_finished(shift, automatic=True)
        if await self.company_account_active(updated.company_id):
            await self._notify_company(
                updated.company_id,
                NotificationType.SHIFT_AUTO_FINISHED,
                "Oído cerró un turno",
                (
                    f"Cerramos automáticamente \"{updated.title or updated.position.label}\": "
                    "pasaron 72 horas desde que la persona marcó la salida. "
                    "Te queda marcarlo como pagado: como pasaron más de 48 horas "
                    "desde el fin del turno, cuenta como pago tardío."
                ),
                link="/shifts",
            )
        return updated

    async def _save_finished(self, shift: Shift, *, automatic: bool = False) -> Shift:
        """Lo común a cerrar un turno trabajado, lo cierre el comercio
        (`finish`) o el sistema (`auto_finish`): guardar con versión y, si
        hubo alguien, sumarle el turno completado a su reputación y avisarle
        que ya puede calificar. La puntualidad es la que quedó registrada en
        la llegada; vive en un solo lugar para que cambiarla toque los dos
        caminos a la vez.

        R2.4: `events_completed` (+1) y `punctuality_rate` (promedio móvil
        simple sobre si el check-in fue hasta 5 min después del horario
        pactado). Mismo patrón que las notificaciones: el efecto vive dentro
        del caso de uso que cierra el ciclo, no en un job aparte.

        También lo usa «Cerrar turno» de la admin (decisión 21). A un
        trabajador con la cuenta suspendida el aviso le queda guardado en la
        app y no le llega al celular, como todos los avisos a una cuenta
        suspendida (ADR-0024, actualización del 2026-11-18, punto 4)."""
        updated = await self._shifts.update(shift)
        if updated.worker_profile_id is not None:
            await self._workers.record_completed_shift(
                updated.worker_profile_id, punctual=self._was_punctual(updated)
            )
            # U018: al cerrar el turno el trabajador ya puede calificar al
            # comercio. `/my-shifts` no toma el id del turno por la URL: abre
            # la lista, donde el turno cerrado trae su caja de calificación.
            company = await self._companies.get_by_id(updated.company_id)
            company_name = (company.name if company is not None else None) or "el comercio"
            name = updated.title or updated.position.label
            if automatic:
                title = "Se cerró tu turno"
                message = (
                    f"\"{name}\" se cerró solo porque pasaron 72 horas desde tu salida. "
                    f"Ya podés calificar a {company_name}."
                )
            else:
                title = "Cerró tu turno"
                message = f"Calificá a {company_name} por el turno \"{name}\"."
            await self._notify_worker(
                updated.worker_profile_id,
                NotificationType.SHIFT_FINISHED,
                title,
                message,
                link=f"/my-shifts?turno={updated.id}",
            )
        return updated

    @staticmethod
    def _was_punctual(shift: Shift) -> bool | None:
        """Puntual = marcó hasta 5 min después de `start_at` (antes, siempre), o
        el comercio dijo que llegó a horario.
        `None` = este turno no mueve la puntualidad (lo tomó ya empezado, U080).

        La regla vive en `shift/domain/punctuality.py`.
        """
        return punctuality_of(
            shift.check_in_at,
            shift.start_at,
            shift.taken_after_start,
            shift.arrival_on_time,
        )

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

        Reputación del comercio (`on_time_payment_rate`, docs/reference/REPUTATION.md):
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
                f"Te pagaron el turno \"{updated.title or updated.position.label}\".",
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

    async def pending_applicant_counts(self, shifts: list[Shift]) -> dict[UUID, int]:
        """Cuántas postulaciones PENDIENTES tiene cada turno (una sola consulta
        agrupada para toda la página). Sólo para el panel del comercio dueño."""
        return await self._applications.count_pending_by_shift_ids([s.id for s in shifts])

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
        origin: FeedOrigin | None = None,
        nearby_only: bool = False,
    ) -> list[Shift]:
        """Turnos abiertos para el trabajador.

        `origin` es desde dónde se mide «cerca» (la zona de su perfil, o el
        punto de una búsqueda). `nearby_only` es el feed del Inicio y del
        Mapa: sólo lo que queda dentro de `FEED_RADIUS_KM`. Sin él es Buscar,
        la pantalla para mirar otras zonas: se muestra todo, ordenado por
        distancia cuando hay desde dónde medir.

        Antes esto era siempre "los 50 más nuevos del país, urgentes
        primero". Como todo turno sin cubrir pasa a urgente a los
        `ESCALATION_DELAY`, con más de 50 abiertos uno nuevo y cercano quedaba
        afuera de la página, y en «Cerca tuyo» aparecía uno de otra provincia.
        """
        filters = {
            "city": city,
            "position": position,
            "positions": positions,
            "urgent": urgent,
        }
        point = origin.point if origin is not None else None

        if nearby_only and origin is not None and origin.is_known:
            # Filtro grueso en SQL (caja de coordenadas) y sin cortar la
            # página todavía; la distancia exacta y el corte van después.
            # Sin punto (perfil con ciudad pero sin coordenadas) no hay caja:
            # se traen los abiertos y se compara la ciudad.
            box = bounding_box(*point, FEED_RADIUS_KM) if point is not None else None
            candidates = await self._shifts.list_open_unpaged(**filters, box=box)
            # Los turnos que no dicen dónde son se miden desde el local del
            # comercio, igual que en el aviso (`zone_of`).
            locals_ = await locals_of_unplaced(candidates, self._companies)
            nearby = [
                s for s in candidates if is_nearby(s, origin, FEED_RADIUS_KM, locals_)
            ]
            # El corte de la página es por CERCANÍA y recién adentro van los
            # urgentes primero. Si el corte también fuera "urgentes primero",
            # una zona con más urgentes que el tope volvería a dejar afuera al
            # turno recién publicado de la vuelta, que todavía no es urgente.
            page = closest_first(nearby, origin, locals_)[offset : offset + limit]
            return urgent_first(page, origin, locals_)

        if point is not None:
            page = await self._shifts.list_open(
                **filters, limit=limit, offset=offset, nearest_to=point
            )
            return closest_first(page, origin)

        # Sin desde dónde medir (no es trabajador, o su perfil no tiene zona):
        # como siempre, urgentes primero y después los más nuevos.
        return await self._shifts.list_open(**filters, limit=limit, offset=offset)

    async def pay_bands(self, shifts: list[Shift]) -> dict[UUID, PayBand]:
        """Banda de pago de cada turno contra la referencia del mercado
        (ADR-0012): por encima / típico / por debajo de lo que se paga por
        hora para ese puesto en esa ciudad.

        Un turno queda FUERA del resultado cuando no hay con qué compararlo
        —muestra insuficiente, sin ciudad, o duración inconsistente— y eso es
        lo normal al arrancar, no un error: quien llama no muestra nada. Es
        preferible a inventar una referencia, que engañaría a las dos partes.

        UNA sola consulta para toda la página, sin importar cuántas
        combinaciones de puesto/ciudad aparezcan: el costo no crece con la
        variedad del feed (hay un test que lo fija).
        """
        pairs = {
            (shift.position, shift.city.lower()) for shift in shifts if shift.city
        }
        if not pairs:
            return {}

        since = datetime.now(timezone.utc) - timedelta(days=BENCHMARK_WINDOW_DAYS)
        samples = await self._shifts.hourly_pay_samples(sorted(pairs), since=_naive(since))
        benchmarks = {key: build_benchmark(rates) for key, rates in samples.items()}

        bands: dict[UUID, PayBand] = {}
        for shift in shifts:
            if not shift.city:
                continue
            benchmark = benchmarks.get((shift.position, shift.city.lower()))
            if benchmark is None:
                continue
            rate = hourly_rate(shift.pay_amount, shift.start_at, shift.end_at)
            if rate is None:
                continue
            bands[shift.id] = classify(rate, benchmark)
        return bands

    async def _get_owned(self, company_id: UUID, shift_id: UUID) -> Shift:
        shift = await self._shifts.get_by_id(shift_id)
        # No revelamos turnos de otros comercios: se tratan como inexistentes.
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))
        return shift
