"""Modelos ORM del módulo lead: los comercios a captar (`leads`) y la copia
semanal de OpenStreetMap por barrio (`lead_place_snapshots` y
`lead_snapshot_barrios`, ADR-0029)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID
from app.modules.lead.domain.value_objects import LeadStatus


class LeadModel(Base):
    __tablename__ = "leads"
    __table_args__ = (UniqueConstraint("osm_ref", name="uq_leads_osm_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    # "node/123", "way/456": identifica al comercio en OpenStreetMap y es lo
    # que hace idempotente volver a importar un barrio.
    osm_ref: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    barrio: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(300), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=LeadStatus.NUEVO.value, index=True
    )
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PlaceSnapshotBarrioModel(Base):
    """De cuándo es la copia de cada barrio y cuántos comercios trae. Una
    copia con 0 comercios no cuenta como copia (ADR-0029, 2026-11-22): el
    refresco la vuelve a pedir sola."""

    __tablename__ = "lead_snapshot_barrios"

    barrio: Mapped[str] = mapped_column(String(60), primary_key=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    places: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PlaceSnapshotModel(Base):
    """Un comercio de la copia de OSM de un barrio (los campos de
    `PlaceCandidate`, con los mismos largos que `leads`)."""

    __tablename__ = "lead_place_snapshots"
    __table_args__ = (
        UniqueConstraint("barrio", "osm_ref", name="uq_lead_place_snapshots_barrio_osm_ref"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    barrio: Mapped[str] = mapped_column(String(60), nullable=False)
    osm_ref: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(300), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
