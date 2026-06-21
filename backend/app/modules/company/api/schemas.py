"""Esquemas HTTP (Pydantic) del módulo company."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.company.domain.value_objects import CompanyCategory


class CompanyProfileInput(BaseModel):
    """Payload de alta/edición del perfil del comercio (sólo campos editables)."""

    name: str = Field(min_length=1, max_length=255)
    logo_url: str | None = Field(default=None, max_length=512)
    category: CompanyCategory | None = None
    description: str | None = Field(default=None, max_length=1000)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    capacity: int | None = Field(default=None, ge=0)
    opening_hours: str | None = Field(default=None, max_length=255)


class CompanyProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    logo_url: str | None
    category: CompanyCategory | None
    description: str | None
    address: str | None
    city: str | None
    latitude: float | None
    longitude: float | None
    capacity: int | None
    opening_hours: str | None
    # métricas
    rating: float
    events_published: int
    on_time_payment_rate: float
    created_at: datetime | None = None
