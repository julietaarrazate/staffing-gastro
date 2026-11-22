"""Adaptadores SQLAlchemy del módulo lead: LeadRepository y
PlaceSnapshotRepository (copia semanal de OSM, ADR-0029)."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.lead.domain.entities import Lead, PlaceCandidate, PlaceSnapshot
from app.modules.lead.domain.repositories import LeadRepository, PlaceSnapshotRepository
from app.modules.lead.domain.value_objects import LeadKind, LeadStatus
from app.modules.lead.infrastructure.models import (
    LeadModel,
    PlaceSnapshotBarrioModel,
    PlaceSnapshotModel,
)

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


_PLACE_FIELDS = (
    "osm_ref",
    "name",
    "latitude",
    "longitude",
    "address",
    "phone",
    "website",
    "instagram",
    "email",
)


def _utc(value: datetime) -> datetime:
    """SQLite (tests) devuelve las fechas sin zona; Postgres, con. Se guardan en UTC."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class SqlAlchemyPlaceSnapshotRepository(PlaceSnapshotRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, barrio: str) -> PlaceSnapshot | None:
        meta = await self._session.get(PlaceSnapshotBarrioModel, barrio)
        if meta is None:
            return None
        result = await self._session.execute(
            select(PlaceSnapshotModel)
            .where(PlaceSnapshotModel.barrio == barrio)
            .order_by(PlaceSnapshotModel.osm_ref)
        )
        places = tuple(
            PlaceCandidate(
                barrio=m.barrio,
                kind=LeadKind(m.kind),
                **{name: getattr(m, name) for name in _PLACE_FIELDS},
            )
            for m in result.scalars().all()
        )
        return PlaceSnapshot(barrio=barrio, fetched_at=_utc(meta.fetched_at), places=places)

    async def fetched_at_by_barrio(self) -> dict[str, datetime]:
        result = await self._session.execute(
            select(PlaceSnapshotBarrioModel.barrio, PlaceSnapshotBarrioModel.fetched_at).where(
                PlaceSnapshotBarrioModel.places > 0
            )
        )
        return {barrio: _utc(fetched_at) for barrio, fetched_at in result.all()}

    async def replace(self, snapshot: PlaceSnapshot) -> None:
        await self._session.execute(
            delete(PlaceSnapshotModel).where(PlaceSnapshotModel.barrio == snapshot.barrio)
        )
        for place in snapshot.places:
            self._session.add(
                PlaceSnapshotModel(
                    barrio=snapshot.barrio,
                    kind=place.kind.value,
                    fetched_at=snapshot.fetched_at,
                    **{name: getattr(place, name) for name in _PLACE_FIELDS},
                )
            )
        meta = await self._session.get(PlaceSnapshotBarrioModel, snapshot.barrio)
        if meta is None:
            meta = PlaceSnapshotBarrioModel(barrio=snapshot.barrio)
            self._session.add(meta)
        meta.fetched_at = snapshot.fetched_at
        meta.places = len(snapshot.places)
        await self._session.commit()
