"""Adaptador SQLAlchemy del ShiftApplicationRepository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.application.domain.entities import ShiftApplication
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.application.domain.value_objects import ApplicationStatus
from app.modules.application.infrastructure.models import ShiftApplicationModel


def _to_entity(model: ShiftApplicationModel) -> ShiftApplication:
    return ShiftApplication(
        id=model.id,
        shift_id=model.shift_id,
        worker_profile_id=model.worker_profile_id,
        status=ApplicationStatus(model.status),
        created_at=model.created_at,
    )


class SqlAlchemyShiftApplicationRepository(ShiftApplicationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, application: ShiftApplication) -> ShiftApplication:
        model = ShiftApplicationModel(
            id=application.id,
            shift_id=application.shift_id,
            worker_profile_id=application.worker_profile_id,
            status=application.status.value,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, application: ShiftApplication) -> ShiftApplication:
        model = await self._session.get(ShiftApplicationModel, application.id)
        if model is None:
            raise ValueError(f"Postulación {application.id} no encontrada")
        model.status = application.status.value
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_shift_and_worker(
        self, shift_id: UUID, worker_profile_id: UUID
    ) -> ShiftApplication | None:
        stmt = select(ShiftApplicationModel).where(
            ShiftApplicationModel.shift_id == shift_id,
            ShiftApplicationModel.worker_profile_id == worker_profile_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_by_shift(self, shift_id: UUID) -> list[ShiftApplication]:
        stmt = (
            select(ShiftApplicationModel)
            .where(ShiftApplicationModel.shift_id == shift_id)
            .order_by(ShiftApplicationModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_worker(self, worker_profile_id: UUID) -> list[ShiftApplication]:
        stmt = (
            select(ShiftApplicationModel)
            .where(ShiftApplicationModel.worker_profile_id == worker_profile_id)
            .order_by(ShiftApplicationModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]
