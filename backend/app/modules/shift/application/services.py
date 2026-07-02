"""Casos de uso del módulo shift (publicación y ciclo de vida del turno)."""

from uuid import UUID

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
from app.modules.worker.domain.repositories import WorkerProfileRepository
from app.modules.worker.domain.value_objects import WorkerSkill


class ShiftService:
    """Servicio de aplicación para gestionar turnos."""

    def __init__(
        self,
        shifts: ShiftRepository,
        workers: WorkerProfileRepository,
        companies: CompanyProfileRepository,
        notifications: NotificationRepository,
    ) -> None:
        self._shifts = shifts
        self._workers = workers
        self._companies = companies
        self._notifications = notifications

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
        shift.publish()
        return await self._shifts.update(shift)

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
        """El trabajador asignado confirma su asistencia al turno."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.confirm()
        updated = await self._shifts.update(shift)
        await self._notify_company(
            updated.company_id,
            NotificationType.SHIFT_CONFIRMED,
            "Confirmaron un turno",
            f"El trabajador asignado confirmó su asistencia al turno \"{updated.title or updated.position.value}\".",
        )
        return updated

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
        """El comercio cierra el turno trabajado."""
        shift = await self._get_owned(company_id, shift_id)
        shift.finish()
        return await self._shifts.update(shift)

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
