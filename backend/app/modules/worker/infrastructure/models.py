"""Modelo ORM del perfil del trabajador (tabla `worker_profiles`)."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID
from app.modules.worker.domain.value_objects import GamificationLevel


class WorkerProfileModel(Base):
    __tablename__ = "worker_profiles"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )

    # --- Datos del perfil ---
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    years_experience: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    languages: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    certifications: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    cv_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # --- Métricas ---
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    events_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    punctuality_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cancellations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    no_shows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    badges: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    level: Mapped[str] = mapped_column(
        String(20), nullable=False, default=GamificationLevel.BRONCE.value
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
