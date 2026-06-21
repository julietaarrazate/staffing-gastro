"""Adaptador SQLAlchemy del ShiftRepository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import OPEN_STATUSES, ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill

# Campos editables que se copian de la entidad al modelo.
_EDITABLE_FIELDS = (
    "position",
    "quantity",
    "start_at",
    "end_at",
    "pay_amount",
    "currency",
    "tips",
    "dress_code",
    "urgent",
    "address",
    "city",
    "latitude",
    "longitude",
    "title",
    "description",
)


def _to_entity(model: ShiftModel) -> Shift:
    return Shift(
        id=model.id,
        company_id=model.company_id,
        position=WorkerSkill(model.position),
        quantity=model.quantity,
        start_at=model.start_at,
        end_at=model.end_at,
        pay_amount=model.pay_amount,
        currency=model.currency,
        tips=model.tips,
        dress_code=model.dress_code,
        urgent=model.urgent,
        address=model.address,
        city=model.city,
        latitude=model.latitude,
        longitude=model.longitude,
        title=model.title,
        description=model.description,
        status=ShiftStatus(model.status),
        worker_profile_id=model.worker_profile_id,
        check_in_latitude=model.check_in_latitude,
        check_in_longitude=model.check_in_longitude,
        check_in_at=model.check_in_at,
        check_out_latitude=model.check_out_latitude,
        check_out_longitude=model.check_out_longitude,
        check_out_at=model.check_out_at,
        paid_at=model.paid_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _apply_fields(model: ShiftModel, shift: Shift) -> None:
    for name in _EDITABLE_FIELDS:
        value = getattr(shift, name)
        if name == "position":
            value = value.value
        setattr(model, name, value)
    model.status = shift.status.value
    model.worker_profile_id = shift.worker_profile_id
    model.check_in_latitude = shift.check_in_latitude
    model.check_in_longitude = shift.check_in_longitude
    model.check_in_at = shift.check_in_at
    model.check_out_latitude = shift.check_out_latitude
    model.check_out_longitude = shift.check_out_longitude
    model.check_out_at = shift.check_out_at
    model.paid_at = shift.paid_at


class SqlAlchemyShiftRepository(ShiftRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, shift: Shift) -> Shift:
        model = ShiftModel(id=shift.id, company_id=shift.company_id)
        _apply_fields(model, shift)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, shift: Shift) -> Shift:
        model = await self._session.get(ShiftModel, shift.id)
        if model is None:
            raise ValueError("El turno no existe")
        _apply_fields(model, shift)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, shift_id: UUID) -> Shift | None:
        model = await self._session.get(ShiftModel, shift_id)
        return _to_entity(model) if model else None

    async def list_by_company(self, company_id: UUID) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(ShiftModel.company_id == company_id)
            .order_by(ShiftModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_worker(self, worker_profile_id: UUID) -> list[Shift]:
        stmt = (
            select(ShiftModel)
            .where(ShiftModel.worker_profile_id == worker_profile_id)
            .order_by(ShiftModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_open(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        urgent: bool | None = None,
    ) -> list[Shift]:
        stmt = select(ShiftModel).where(
            ShiftModel.status.in_([s.value for s in OPEN_STATUSES])
        )
        if city is not None:
            stmt = stmt.where(func.lower(ShiftModel.city) == city.lower())
        if position is not None:
            stmt = stmt.where(ShiftModel.position == position.value)
        if urgent is not None:
            stmt = stmt.where(ShiftModel.urgent.is_(urgent))
        # Urgentes primero, luego los más recientes.
        stmt = stmt.order_by(ShiftModel.urgent.desc(), ShiftModel.created_at.desc())
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]
