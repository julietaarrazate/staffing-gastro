"""Adaptador SQLAlchemy del CandidateRepository.

Lee directamente de `worker_profiles` (módulo worker) y mapea a los DTOs
livianos del dominio de matching, sin depender de sus entidades.
"""

from sqlalchemy import String, cast, select
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
        no_shows=model.no_shows,
        is_available=model.is_available,
        latitude=model.latitude,
        longitude=model.longitude,
    )


class SqlAlchemyCandidateRepository(CandidateRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_available(
        self, skill: WorkerSkill | None = None
    ) -> list[CandidateProfile]:
        # P3 (docs/audits/PERFORMANCE_REPORT.md): antes se traían TODOS los
        # `worker_profiles` disponibles y se filtraba por `skill` en Python
        # (full scan). Ahora is_available + skill se filtran en SQL; el
        # scoring ponderado (Haversine, experiencia, etc.) sigue en Python
        # sobre el subconjunto ya acotado, porque es lógica de dominio.
        #
        # `skills` es una columna JSON (lista de strings). SQLAlchemy no
        # tiene un operador "contiene" portable entre SQLite y Postgres para
        # el tipo genérico `JSON` (Postgres tendría `@>`/`?|` sobre JSONB,
        # SQLite no). En cambio, `CAST(skills AS TEXT) LIKE '%"mozo"%'` sí es
        # portable: ambos motores serializan el string como JSON entrecomillado
        # (`"mozo"`), y como buscamos el token completo entre comillas (no un
        # substring libre), no matchea skills que sólo comparten prefijo
        # (p. ej. filtrar por "mozo" no matchea un skill guardado como
        # "mozo_bar").
        stmt = (
            select(WorkerProfileModel, UserModel.full_name)
            .join(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(WorkerProfileModel.is_available.is_(True))
        )
        if skill is not None:
            needle = f'%"{skill.value}"%'
            stmt = stmt.where(cast(WorkerProfileModel.skills, String).like(needle))
        result = await self._session.execute(stmt)
        rows = result.all()
        return [_to_candidate(model, full_name) for model, full_name in rows]
