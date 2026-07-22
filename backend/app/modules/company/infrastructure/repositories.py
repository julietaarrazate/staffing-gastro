"""Adaptador SQLAlchemy del CompanyProfileRepository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.company.domain.entities import CompanyProfile
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.company.domain.value_objects import CompanyCategory
from app.modules.company.infrastructure.models import CompanyProfileModel


def _to_entity(model: CompanyProfileModel) -> CompanyProfile:
    return CompanyProfile(
        id=model.id,
        user_id=model.user_id,
        name=model.name,
        logo_url=model.logo_url,
        category=CompanyCategory(model.category) if model.category else None,
        description=model.description,
        address=model.address,
        city=model.city,
        latitude=model.latitude,
        longitude=model.longitude,
        capacity=model.capacity,
        opening_hours=model.opening_hours,
        rating=model.rating,
        events_published=model.events_published,
        on_time_payment_rate=model.on_time_payment_rate,
        late_cancellations=model.late_cancellations,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _apply_editable_fields(model: CompanyProfileModel, profile: CompanyProfile) -> None:
    """Copia los campos editables del perfil al modelo (no toca métricas)."""
    model.name = profile.name
    model.logo_url = profile.logo_url
    model.category = profile.category.value if profile.category else None
    model.description = profile.description
    model.address = profile.address
    model.city = profile.city
    model.latitude = profile.latitude
    model.longitude = profile.longitude
    model.capacity = profile.capacity
    model.opening_hours = profile.opening_hours


class SqlAlchemyCompanyProfileRepository(CompanyProfileRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, profile: CompanyProfile) -> CompanyProfile:
        model = CompanyProfileModel(id=profile.id, user_id=profile.user_id, name=profile.name)
        _apply_editable_fields(model, profile)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def update(self, profile: CompanyProfile) -> CompanyProfile:
        model = await self._session.get(CompanyProfileModel, profile.id)
        if model is None:
            raise ValueError("El perfil no existe")
        _apply_editable_fields(model, profile)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, profile_id: UUID) -> CompanyProfile | None:
        model = await self._session.get(CompanyProfileModel, profile_id)
        return _to_entity(model) if model else None

    async def list_by_ids(self, profile_ids: list[UUID]) -> dict[UUID, CompanyProfile]:
        if not profile_ids:
            return {}
        # Único `SELECT ... WHERE id IN (...)` (P3, docs/PERFORMANCE_REPORT.md):
        # reemplaza el `get_by_id` repetido por comercio distinto en un
        # listado (feed/mis-turnos asignados).
        stmt = select(CompanyProfileModel).where(CompanyProfileModel.id.in_(profile_ids))
        result = await self._session.execute(stmt)
        return {model.id: _to_entity(model) for model in result.scalars().all()}

    async def get_by_user_id(self, user_id: UUID) -> CompanyProfile | None:
        stmt = select(CompanyProfileModel).where(CompanyProfileModel.user_id == user_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def exists_by_user_id(self, user_id: UUID) -> bool:
        stmt = select(CompanyProfileModel.id).where(CompanyProfileModel.user_id == user_id)
        result = await self._session.execute(stmt)
        return result.first() is not None

    async def update_rating(self, profile_id: UUID, rating: float) -> None:
        model = await self._session.get(CompanyProfileModel, profile_id)
        if model is None:
            return
        model.rating = rating
        await self._session.commit()

    async def record_late_cancellation(self, profile_id: UUID) -> None:
        model = await self._session.get(CompanyProfileModel, profile_id)
        if model is None:
            return
        model.late_cancellations += 1
        await self._session.commit()
