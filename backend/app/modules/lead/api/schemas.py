"""Esquemas HTTP (Pydantic) del módulo lead."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.lead.domain.value_objects import LeadKind, LeadStatus


class LeadResponse(BaseModel):
    id: UUID
    osm_ref: str
    name: str
    kind: LeadKind
    barrio: str
    latitude: float
    longitude: float
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    instagram: str | None = None
    email: str | None = None
    status: LeadStatus
    notes: str = ""
    priority: int
    contacted_at: datetime | None = None
    updated_at: datetime | None = None


class LeadUpdateRequest(BaseModel):
    status: LeadStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)


class LeadImportRequest(BaseModel):
    barrio: str = Field(min_length=1, max_length=60)


class LeadImportResponse(BaseModel):
    barrio: str
    found: int
    created: int
    updated: int


class LeadSummaryResponse(BaseModel):
    counts: dict[LeadStatus, int]
    total: int
