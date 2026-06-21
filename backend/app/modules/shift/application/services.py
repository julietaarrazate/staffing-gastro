"""Casos de uso del módulo shift (publicación y ciclo de vida del turno)."""

from uuid import UUID

from app.modules.shift.application.dtos import ShiftData
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import (
    ShiftNotAssignedToWorkerError,
    ShiftNotFoundError,
)
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.worker.domain.value_objects import WorkerSkill


class ShiftService:
    """Servicio de aplicación para gestionar turnos."""

    def __init__(self, shifts: ShiftRepository) -> None:
        self._shifts = shifts

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
        return await self._shifts.update(shift)

    async def confirm_assignment(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> Shift:
        """El trabajador asignado confirma su asistencia al turno."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.confirm()
        return await self._shifts.update(shift)

    async def reject_assignment(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> Shift:
        """El trabajador asignado rechaza el turno; vuelve a buscar personal."""
        shift = await self._get_assigned_to(worker_profile_id, shift_id)
        shift.reject()
        return await self._shifts.update(shift)

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

    async def list_company_shifts(self, company_id: UUID) -> list[Shift]:
        return await self._shifts.list_by_company(company_id)

    async def list_feed(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        urgent: bool | None = None,
    ) -> list[Shift]:
        return await self._shifts.list_open(city=city, position=position, urgent=urgent)

    async def _get_owned(self, company_id: UUID, shift_id: UUID) -> Shift:
        shift = await self._shifts.get_by_id(shift_id)
        # No revelamos turnos de otros comercios: se tratan como inexistentes.
        if shift is None or shift.company_id != company_id:
            raise ShiftNotFoundError(str(shift_id))
        return shift
