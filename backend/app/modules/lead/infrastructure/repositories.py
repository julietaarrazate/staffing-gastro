"""Adaptador SQLAlchemy del LeadRepository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.lead.domain.entities import Lead
from app.modules.lead.domain.repositories import LeadRepository
from app.modules.lead.domain.value_objects import LeadKind, LeadStatus
from app.modules.lead.infrastructure.models import LeadModel

_FIELDS = (
    "osm_ref",
    "name",
    "barrio",
    "latitude",
    "longitude",
    "address",
    "phone",
    "website",
    "instagram",
    "email",
    "notes",
    "contacted_at",
)


def _to_entity(model: LeadModel) -> Lead:
    return Lead(
        id=model.id,
        kind=LeadKind(model.kind),
        status=LeadStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
        **{name: getattr(model, name) for name in _FIELDS},
    )


def _copy_into(model: LeadModel, lead: Lead) -> None:
    for name in _FIELDS:
        setattr(model, name, getattr(lead, name))
    model.kind = lead.kind.value
    model.status = lead.status.value


class SqlAlchemyLeadRepository(LeadRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, lead_id: UUID) -> Lead | None:
        model = await self._session.get(LeadModel, lead_id)
        return _to_entity(model) if model else None

    async def get_by_osm_refs(self, osm_refs: list[str]) -> dict[str, Lead]:
        if not osm_refs:
            return {}
        result = await self._session.execute(
            select(LeadModel).where(LeadModel.osm_ref.in_(osm_refs))
        )
        return {m.osm_ref: _to_entity(m) for m in result.scalars().all()}

    async def save_many(self, leads: list[Lead]) -> None:
        if not leads:
            return
        ids = [lead.id for lead in leads]
        result = await self._session.execute(
            select(LeadModel).where(LeadModel.id.in_(ids))
        )
        stored = {m.id: m for m in result.scalars().all()}
        for lead in leads:
            model = stored.get(lead.id)
            if model is None:
                model = LeadModel(id=lead.id)
                self._session.add(model)
            _copy_into(model, lead)
        await self._session.commit()

    async def update(self, lead: Lead) -> Lead:
        model = await self._session.get(LeadModel, lead.id)
        if model is None:  # pragma: no cover — el caso de uso ya lo buscó
            raise LookupError(str(lead.id))
        _copy_into(model, lead)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def find(
        self,
        *,
        status: LeadStatus | None = None,
        barrio: str | None = None,
    ) -> list[Lead]:
        stmt = select(LeadModel)
        if status is not None:
            stmt = stmt.where(LeadModel.status == status.value)
        if barrio is not None:
            stmt = stmt.where(LeadModel.barrio == barrio)
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def count_by_status(self, *, barrio: str | None = None) -> dict[LeadStatus, int]:
        stmt = select(LeadModel.status, func.count(LeadModel.id)).group_by(LeadModel.status)
        if barrio is not None:
            stmt = stmt.where(LeadModel.barrio == barrio)
        result = await self._session.execute(stmt)
        return {LeadStatus(status): count for status, count in result.all()}
