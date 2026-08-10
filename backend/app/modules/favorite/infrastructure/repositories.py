"""Adaptador SQLAlchemy del FavoriteRepository.

`list_by_company` enriquece con los datos del trabajador (mismo patrón que
`application/infrastructure/repositories.py`) y con `shifts_together`, un
`COUNT` correlacionado sobre `shifts` (turnos FINALIZADO/PAGADO entre ESE
comercio y ESE trabajador) — todo en una sola consulta, sin N+1.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.favorite.domain.entities import EnrichedFavorite, Favorite
from app.modules.favorite.domain.repositories import FavoriteRepository
from app.modules.favorite.infrastructure.models import FavoriteModel
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.models import WorkerProfileModel

_COMPLETED_STATUSES = (ShiftStatus.FINALIZADO.value, ShiftStatus.PAGADO.value)


def _to_entity(model: FavoriteModel) -> Favorite:
    return Favorite(
        id=model.id,
        company_id=model.company_id,
        worker_profile_id=model.worker_profile_id,
        created_at=model.created_at,
    )


class SqlAlchemyFavoriteRepository(FavoriteRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, favorite: Favorite) -> Favorite:
        model = FavoriteModel(
            id=favorite.id,
            company_id=favorite.company_id,
            worker_profile_id=favorite.worker_profile_id,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def remove(self, company_id: UUID, worker_profile_id: UUID) -> None:
        stmt = select(FavoriteModel).where(
            FavoriteModel.company_id == company_id,
            FavoriteModel.worker_profile_id == worker_profile_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is not None:
            await self._session.delete(model)
            await self._session.commit()

    async def get_by_company_and_worker(
        self, company_id: UUID, worker_profile_id: UUID
    ) -> Favorite | None:
        stmt = select(FavoriteModel).where(
            FavoriteModel.company_id == company_id,
            FavoriteModel.worker_profile_id == worker_profile_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_by_company(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[EnrichedFavorite]:
        shifts_together = (
            select(func.count(ShiftModel.id))
            .where(
                ShiftModel.company_id == FavoriteModel.company_id,
                ShiftModel.worker_profile_id == FavoriteModel.worker_profile_id,
                ShiftModel.status.in_(_COMPLETED_STATUSES),
            )
            .correlate(FavoriteModel)
            .scalar_subquery()
        )
        stmt = (
            select(
                FavoriteModel,
                WorkerProfileModel,
                UserModel.full_name,
                shifts_together.label("shifts_together"),
            )
            .join(
                WorkerProfileModel,
                WorkerProfileModel.id == FavoriteModel.worker_profile_id,
            )
            .outerjoin(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(FavoriteModel.company_id == company_id)
            .order_by(FavoriteModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [
            EnrichedFavorite(
                worker_profile_id=favorite.worker_profile_id,
                full_name=full_name or "Trabajador",
                photo_url=worker.photo_url,
                rating=worker.rating,
                skills=tuple(WorkerSkill(s) for s in (worker.skills or [])),
                is_available=worker.is_available,
                events_completed=worker.events_completed,
                shifts_together=together,
                favorited_at=favorite.created_at,
            )
            for favorite, worker, full_name, together in result.all()
        ]
