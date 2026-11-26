"""Esquemas HTTP (Pydantic) del módulo application."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.shift.api.schemas import ShiftResponse
from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shift_id: UUID
    worker_profile_id: UUID
    status: str
    # Sólo con `status == "desasignada"`: `rechazo`, `cancelacion` o `ausencia`.
    motivo: str | None = None
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
    # Quien tuvo el turno y lo dejó (`status == "desasignada"`): `rechazo`,
    # `cancelacion` o `ausencia`. Va al final de la lista, con su marca.
    motivo: str | None = None
    created_at: datetime | None = None
    events_completed: int = 0
    punctuality_rate: float = 0.0
    years_experience: int = 0
    badges: list[WorkerBadge] = []
    level: GamificationLevel = GamificationLevel.BRONCE
    # Sello «Identidad verificada» (documento aprobado por un admin), el mismo
    # que en los recomendados. Se completa en la ruta, por puerto.
    identidad_verificada: bool = False
    # Por qué está donde está en la lista (ADR-0031). Son datos del comercio
    # (sus favoritos, sus turnos) o que ya ve en la ficha de la persona.
    es_favorito: bool = False
    # Ya terminó al menos un turno en este comercio.
    trabajo_aca: bool = False
    # Turnos terminados en Oído en el puesto de este turno.
    turnos_en_el_puesto: int = 0
    # Sello «Nuevo en Oído · identidad verificada»: sin turnos hechos, con la
    # identidad verificada y sin ausencias.
    nuevo_verificado: bool = False
