"""Casos de uso del módulo shift (publicación y ciclo de vida del turno)."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.shift.application.dtos import ShiftData
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import (
    ShiftNotAssignedToWorkerError,
    ShiftNotFoundError,
)
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import COMMITTED_STATUSES
from app.core.config import settings
from app.modules.subscription.domain.plans import get_plan
from app.modules.subscription.domain.repositories import SubscriptionRepository
from app.modules.worker.domain.repositories import WorkerProfileRepository
from app.modules.worker.domain.value_objects import WorkerSkill

# R2.4: tolerancia para considerar "puntual" un check-in respecto del
# horario pactado (start_at). Ver docs/REPUTATION.md.
PUNCTUALITY_TOLERANCE = timedelta(minutes=15)


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
    ) -> None:
        self._shifts = shifts
        self._workers = workers
        self._companies = companies
        self._notifications = notifications
        self._applications = applications
        self._subscriptions = subscriptions

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
        )
        return await self._shifts.add(shift)

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
        return await self._shifts.update(shift)

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
        shift = await self._get_owned(company_id, shift_id)
        shift.cancel()
        return await self._shifts.update(shift)

    async def assign_worker(
        self, company_id: UUID, shift_id: UUID, worker_profile_id: UUID
    ) -> Shift:
        """El comercio asigna el turno a uno de los candidatos recomendados."""
        shift = await self._get_owned(company_id, shift_id)
        shift.assign(worker_profile_id)
        updated = await self._shifts.update(shift)
        await self._notify_worker(
            worker_profile_id,
            NotificationType.SHIFT_ASSIGNED,
            "Te asignaron un turno",
            f"Te asignaron el turno \"{updated.title or updated.position.value}\". Confirmá tu asistencia.",
        )
        return updated

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
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_REJECTED,
            "Rechazaron un turno",
            f"El trabajador asignado rechazó el turno \"{updated.title or updated.position.value}\". Volvió a buscar personal.",
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

        def _naive(dt: datetime) -> datetime:
            return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt

        return abs(_naive(shift.check_in_at) - _naive(shift.start_at)) <= PUNCTUALITY_TOLERANCE

    async def mark_paid(self, company_id: UUID, shift_id: UUID) -> Shift:
        """El comercio confirma que pagó el turno finalizado."""
        shift = await self._get_owned(company_id, shift_id)
        shift.mark_paid()
        updated = await self._shifts.update(shift)
        if updated.worker_profile_id is not None:
            await self._notify_worker(
                updated.worker_profile_id,
                NotificationType.SHIFT_PAID,
                "Te pagaron un turno",
                f"Te pagaron el turno \"{updated.title or updated.position.value}\".",
            )
        return updated

    async def _notify_worker(
        self, worker_profile_id: UUID, type_: NotificationType, title: str, message: str
    ) -> None:
        profile = await self._workers.get_by_id(worker_profile_id)
        if profile is None:
            return
        await self._notifications.add(
            Notification(user_id=profile.user_id, type=type_, title=title, message=message)
        )

    async def _notify_company(
        self, company_id: UUID, type_: NotificationType, title: str, message: str
    ) -> None:
        profile = await self._companies.get_by_id(company_id)
        if profile is None:
            return
        await self._notifications.add(
            Notification(user_id=profile.user_id, type=type_, title=title, message=message)
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
        urgent: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Shift]:
        return await self._shifts.list_open(
            city=city, position=position, urgent=urgent, limit=limit, offset=offset
        )

    async def _get_owned(self, company_id: UUID, shift_id: UUID) -> Shift:
        shift = await self._shifts.get_by_id(shift_id)
        # No revelamos turnos de otros comercios: se tratan como inexistentes.
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))
        return shift
