"""Esquemas HTTP (Pydantic) del módulo application."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shift_id: UUID
    worker_profile_id: UUID
    status: str
    created_at: datetime | None = None


class ApplicantResponse(BaseModel):
    """Postulante a un turno, enriquecido con datos del trabajador para la UI."""

    application_id: UUID
    worker_profile_id: UUID
    full_name: str
    photo_url: str | None = None
    rating: float = 0.0
    is_available: bool = True
    status: str
    created_at: datetime | None = None
