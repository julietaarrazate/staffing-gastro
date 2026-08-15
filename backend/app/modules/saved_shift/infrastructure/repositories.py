"""Adaptador SQLAlchemy del SavedShiftRepository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.saved_shift.domain.entities import SavedShift
from app.modules.saved_shift.domain.repositories import SavedShiftRepository
from app.modules.saved_shift.infrastructure.models import SavedShiftModel


def _to_entity(model: SavedShiftModel) -> SavedShift:
    return SavedShift(
        id=model.id,
        worker_profile_id=model.worker_profile_id,
        shift_id=model.shift_id,
        created_at=model.created_at,
    )


class SqlAlchemySavedShiftRepository(SavedShiftRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, saved: SavedShift) -> SavedShift:
        model = SavedShiftModel(
            id=saved.id,
            worker_profile_id=saved.worker_profile_id,
            shift_id=saved.shift_id,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def remove(self, worker_profile_id: UUID, shift_id: UUID) -> None:
        stmt = select(SavedShiftModel).where(
            SavedShiftModel.worker_profile_id == worker_profile_id,
            SavedShiftModel.shift_id == shift_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is not None:
            await self._session.delete(model)
            await self._session.commit()

    async def get_by_worker_and_shift(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> SavedShift | None:
        stmt = select(SavedShiftModel).where(
            SavedShiftModel.worker_profile_id == worker_profile_id,
            SavedShiftModel.shift_id == shift_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_shift_ids_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[UUID]:
        stmt = (
            select(SavedShiftModel.shift_id)
            .where(SavedShiftModel.worker_profile_id == worker_profile_id)
            .order_by(SavedShiftModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
