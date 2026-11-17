"""Modelo ORM de la encuesta para locales (tabla `survey_responses`)."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class SurveyResponseModel(Base):
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("client_key", name="uq_survey_responses_client_key"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    local_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    barrio: Mapped[str | None] = mapped_column(String(80), nullable=True)
    team_model: Mapped[str] = mapped_column(String(20), nullable=False)
    eventuals_normal_month: Mapped[str] = mapped_column(String(12), nullable=False)
    eventuals_peak_month: Mapped[str] = mapped_column(String(12), nullable=False)
    roles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    current_channels: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    pay_per_shift_ars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_absence_outcome: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    pricing_preference: Mapped[str] = mapped_column(String(20), nullable=False)
    wants_beta: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Contacto: opcional y con retención de 12 meses (ADR-0024).
    contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    business_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # De `?ref=`: qué grupo de WhatsApp la trajo.
    source: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # Clave de reintento del cliente: un reintento no duplica. No es la IP ni
    # nada de la persona: un UUID por intento.
    client_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
