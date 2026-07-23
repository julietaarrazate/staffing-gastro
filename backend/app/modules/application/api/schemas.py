"""Esquemas HTTP (Pydantic) del módulo application."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.shift.api.schemas import ShiftResponse


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shift_id: UUID
    worker_profile_id: UUID
    status: str
    created_at: datetime | None = None
    # Turno embebido: presente en `/applications/mine` (lista de Matches) para
    # que el cliente pinte la tarjeta sin un GET /shifts/{id} por postulación
    # (ver ApplicationService.list_my_applications). Opcional para no romper la
    # respuesta de `apply`/`withdraw`, que sólo devuelven la postulación.
    shift: ShiftResponse | None = None


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
    events_completed: int = 0
    punctuality_rate: float = 0.0
    years_experience: int = 0
