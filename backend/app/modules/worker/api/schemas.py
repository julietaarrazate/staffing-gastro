"""Esquemas HTTP (Pydantic) del módulo worker."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.worker.domain.value_objects import (
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)


class WorkerProfileInput(BaseModel):
    """Payload de alta/edición del perfil (sólo campos editables)."""

    photo_url: str | None = Field(default=None, max_length=512)
    birth_date: date | None = None
    city: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=1000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    skills: list[WorkerSkill] = Field(default_factory=list)
    years_experience: int = Field(default=0, ge=0, le=80)
    languages: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    cv_url: str | None = Field(default=None, max_length=512)
    cv_filename: str | None = Field(default=None, max_length=255)
    is_available: bool = True


class WorkerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str | None = None
    photo_url: str | None
    birth_date: date | None
    age: int | None
    city: str | None
    bio: str | None
    latitude: float | None
    longitude: float | None
    skills: list[WorkerSkill]
    years_experience: int
    languages: list[str]
    certifications: list[str]
    cv_url: str | None
    cv_filename: str | None = None
    is_available: bool
    # métricas
    rating: float
    events_completed: int
    punctuality_rate: float
    cancellations: int
    no_shows: int
    badges: list[WorkerBadge]
    level: GamificationLevel
    # Identidad (EPIC-001, ADR-0010): atributo del dominio Identity, NO una
    # insignia de reputación. Lo ve el comercio; nunca se exponen evidencias.
    identidad_verificada: bool = False
    created_at: datetime | None = None


class WorkerEarningsResponse(BaseModel):
    """Resumen de ganancias del trabajador (pedido de Julieta: "un resumen
    de ganancias acumuladas en el perfil"). Cuenta turnos FINALIZADO/PAGADO
    — ya trabajados, cuenten o no todavía como "cobrados" en el sistema."""

    total_earned: Decimal
    this_month_earned: Decimal
    shifts_completed: int
