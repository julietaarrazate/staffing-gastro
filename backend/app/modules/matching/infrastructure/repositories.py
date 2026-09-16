"""Adaptador SQLAlchemy del CandidateRepository.

Lee directamente de `worker_profiles` (módulo worker) y mapea a los DTOs
livianos del dominio de matching, sin depender de sus entidades.
"""

from datetime import datetime, timezone

from sqlalchemy import String, cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dt import naive as _naive
from app.modules.identity.application.services import GUEST_ACCOUNT_EMAILS
from app.modules.identity.infrastructure.models import UserModel
from app.modules.matching.domain.entities import CandidateProfile
from app.modules.matching.domain.repositories import CandidateRepository
from app.modules.worker.domain.entities import AVAILABLE_NOW_TTL
from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge, WorkerSkill
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _resolve_position(
    model: WorkerProfileModel,
) -> tuple[float | None, float | None, bool, datetime | None]:
    """ADR-0014: mientras "Disponible ahora" está vigente, esa posición
    reemplaza a la del perfil para TODO lo que mida distancia (matching y
    mapa) — un solo punto de resolución para que el resto del dominio no
    tenga que conocer las dos fuentes posibles.

    `position_updated_at` (cuándo se prendió) se deriva de `available_now_until
    - AVAILABLE_NOW_TTL` en vez de guardar un cuarto campo "since": el TTL es
    una constante del sistema, no algo que el usuario elige, así que alcanza
    con recalcularlo."""
    if model.available_now_until is not None and _naive(
        datetime.now(timezone.utc)
    ) < _naive(model.available_now_until):
        since = model.available_now_until - AVAILABLE_NOW_TTL
        return model.available_now_latitude, model.available_now_longitude, True, since
    return model.latitude, model.longitude, False, None


def _to_candidate(model: WorkerProfileModel, full_name: str) -> CandidateProfile:
    latitude, longitude, is_live, updated_at = _resolve_position(model)
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
        latitude=latitude,
        longitude=longitude,
        is_live_position=is_live,
        position_updated_at=updated_at,
        badges=tuple(WorkerBadge(b) for b in (model.badges or [])),
        level=GamificationLevel(model.level),
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
        # La cuenta invitado del trabajador (`GUEST_ACCESS_PIN`, "Explorar sin
        # cuenta") es un sandbox compartido, no un trabajador real: no debe
        # aparecer para un comercio/admin buscando a quién contratar.
        stmt = (
            select(WorkerProfileModel, UserModel.full_name)
            .join(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(WorkerProfileModel.is_available.is_(True))
            .where(UserModel.email.notin_(GUEST_ACCOUNT_EMAILS))
        )
        if skill is not None:
            needle = f'%"{skill.value}"%'
            stmt = stmt.where(cast(WorkerProfileModel.skills, String).like(needle))
        result = await self._session.execute(stmt)
        rows = result.all()
        return [_to_candidate(model, full_name) for model, full_name in rows]
