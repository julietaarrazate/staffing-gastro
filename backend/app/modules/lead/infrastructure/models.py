"""Modelo ORM de los comercios a captar (tabla `leads`)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, UniqueConstraint, func
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
