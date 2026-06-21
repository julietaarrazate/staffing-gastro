"""Adaptador SQLAlchemy del CandidateRepository.

Lee directamente de `worker_profiles` (módulo worker) y mapea a los DTOs
livianos del dominio de matching, sin depender de sus entidades.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import UserModel
from app.modules.matching.domain.entities import CandidateProfile
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.worker.domain.value_objects import WorkerSkill
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _to_candidate(model: WorkerProfileModel, full_name: str) -> CandidateProfile:
    return CandidateProfile(
        profile_id=model.id,
        user_id=model.user_id,
        full_name=full_name,
        photo_url=model.photo_url,
        skills=tuple(WorkerSkill(s) for s in (model.skills or [])),
        years_experience=model.years_experience,
        rating=model.rating,
        punctuality_rate=model.punctuality_rate,
        events_completed=model.events_completed,
        cancellations=model.cancellations,
        is_available=model.is_available,
        latitude=model.latitude,
        longitude=model.longitude,
    )


class SqlAlchemyCandidateRepository(CandidateRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_available_by_skill(
        self, skill: WorkerSkill
    ) -> list[CandidateProfile]:
        stmt = (
            select(WorkerProfileModel, UserModel.full_name)
            .join(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(WorkerProfileModel.is_available.is_(True))
        )
        result = await self._session.execute(stmt)
        rows = result.all()
        # El filtro por habilidad se hace en Python: `skills` es JSON y su
        # representación varía entre motores de base de datos (Postgres/SQLite).
        return [
            _to_candidate(model, full_name)
            for model, full_name in rows
            if skill.value in (model.skills or [])
        ]
