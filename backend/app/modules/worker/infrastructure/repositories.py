"""Adaptador SQLAlchemy del WorkerProfileRepository."""

from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.repositories import WorkerEngagementStats, WorkerProfileRepository
from app.modules.worker.domain.rules import compute_badges, compute_level
from app.modules.worker.domain.value_objects import (
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _to_entity(model: WorkerProfileModel) -> WorkerProfile:
    return WorkerProfile(
        id=model.id,
        user_id=model.user_id,
        photo_url=model.photo_url,
        birth_date=model.birth_date,
        city=model.city,
        bio=model.bio,
        latitude=model.latitude,
        longitude=model.longitude,
        skills=[WorkerSkill(s) for s in (model.skills or [])],
        years_experience=model.years_experience,
        languages=list(model.languages or []),
        certifications=list(model.certifications or []),
        cv_url=model.cv_url,
        cv_filename=model.cv_filename,
        is_available=model.is_available,
        rating=model.rating,
        events_completed=model.events_completed,
        punctuality_rate=model.punctuality_rate,
        cancellations=model.cancellations,
        no_shows=model.no_shows,
        badges=[WorkerBadge(b) for b in (model.badges or [])],
        level=GamificationLevel(model.level),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _apply_editable_fields(model: WorkerProfileModel, profile: WorkerProfile) -> None:
    """Copia los campos editables del perfil al modelo (no toca métricas)."""
    model.photo_url = profile.photo_url
    model.birth_date = profile.birth_date
    model.city = profile.city
    model.bio = profile.bio
    model.latitude = profile.latitude
    model.longitude = profile.longitude
    model.skills = [s.value for s in profile.skills]
    model.years_experience = profile.years_experience
    model.languages = profile.languages
    model.certifications = profile.certifications
    model.cv_url = profile.cv_url
    model.cv_filename = profile.cv_filename
    model.is_available = profile.is_available


class SqlAlchemyWorkerProfileRepository(WorkerProfileRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, profile: WorkerProfile) -> WorkerProfile:
        model = WorkerProfileModel(id=profile.id, user_id=profile.user_id)
        _apply_editable_fields(model, profile)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, profile: WorkerProfile) -> WorkerProfile:
        model = await self._session.get(WorkerProfileModel, profile.id)
        if model is None:
            raise ValueError("El perfil no existe")
        _apply_editable_fields(model, profile)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, profile_id: UUID) -> WorkerProfile | None:
        model = await self._session.get(WorkerProfileModel, profile_id)
        return _to_entity(model) if model else None

    async def get_by_user_id(self, user_id: UUID) -> WorkerProfile | None:
        stmt = select(WorkerProfileModel).where(WorkerProfileModel.user_id == user_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def exists_by_user_id(self, user_id: UUID) -> bool:
        stmt = select(WorkerProfileModel.id).where(WorkerProfileModel.user_id == user_id)
        result = await self._session.execute(stmt)
        return result.first() is not None

    async def photo_urls_by_user_ids(self, user_ids: list[UUID]) -> dict[UUID, str | None]:
        if not user_ids:
            return {}
        stmt = select(WorkerProfileModel.user_id, WorkerProfileModel.photo_url).where(
            WorkerProfileModel.user_id.in_(user_ids)
        )
        result = await self._session.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    async def update_rating(self, profile_id: UUID, rating: float) -> None:
        model = await self._session.get(WorkerProfileModel, profile_id)
        if model is None:
            return
        model.rating = rating
        await self._session.commit()

    async def record_completed_shift(self, profile_id: UUID, *, punctual: bool) -> None:
        model = await self._session.get(WorkerProfileModel, profile_id)
        if model is None:
            return
        # Promedio móvil simple: el nuevo rate pondera todos los eventos
        # completados hasta ahora (incluido el actual). `events_completed`
        # todavía no fue incrementado en este punto, así que representa la
        # cantidad de eventos previos.
        previous_events = model.events_completed
        new_events = previous_events + 1
        model.punctuality_rate = (
            model.punctuality_rate * previous_events + (1.0 if punctual else 0.0)
        ) / new_events
        model.events_completed = new_events
        self._recompute_badges_and_level(model)
        await self._session.commit()

    async def record_cancellation(self, profile_id: UUID) -> None:
        model = await self._session.get(WorkerProfileModel, profile_id)
        if model is None:
            return
        model.cancellations += 1
        self._recompute_badges_and_level(model)
        await self._session.commit()

    async def record_no_show(self, profile_id: UUID) -> None:
        model = await self._session.get(WorkerProfileModel, profile_id)
        if model is None:
            return
        model.no_shows += 1
        self._recompute_badges_and_level(model)
        await self._session.commit()

    async def count_engagement_stats(self) -> WorkerEngagementStats:
        # Una sola query con SUM/CASE (mismo patrón que
        # `UserRepository.count_stats`), no traer filas y contar en Python.
        stmt = select(
            func.sum(WorkerProfileModel.events_completed).label("completed_total"),
            func.sum(WorkerProfileModel.cancellations).label("cancellations_total"),
            func.sum(WorkerProfileModel.no_shows).label("no_shows_total"),
            func.sum(case((WorkerProfileModel.events_completed >= 1, 1), else_=0)).label(
                "workers_1plus"
            ),
            func.sum(case((WorkerProfileModel.events_completed >= 2, 1), else_=0)).label(
                "workers_2plus"
            ),
        )
        row = (await self._session.execute(stmt)).one()
        return WorkerEngagementStats(
            completed_total=row.completed_total or 0,
            cancellations_total=row.cancellations_total or 0,
            no_shows_total=row.no_shows_total or 0,
            workers_with_1plus_events=row.workers_1plus or 0,
            workers_with_2plus_events=row.workers_2plus or 0,
        )

    @staticmethod
    def _recompute_badges_and_level(model: WorkerProfileModel) -> None:
        """Recalcula `badges`/`level` a partir de las métricas ya actualizadas
        del modelo (ADR-0004), usando las funciones puras de dominio."""
        profile = _to_entity(model)
        badges = compute_badges(profile)
        # Orden estable (el del catálogo `WorkerBadge`), no el de iteración de un set.
        model.badges = [b.value for b in WorkerBadge if b in badges]
        model.level = compute_level(profile).value
