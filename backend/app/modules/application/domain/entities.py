"""Entidades del dominio de postulaciones (un trabajador se postula a un turno)."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.application.domain.value_objects import ApplicationStatus


@dataclass
class ShiftApplication:
    """Manifestación de interés de un trabajador por un turno abierto.

    Es el lado "trabajador" del match estilo Tinder: el trabajador se postula
    (PENDIENTE) y el comercio puede asignarle el turno (lo que la marca como
    ACEPTADA) o seguir con otro candidato. Un trabajador se postula una sola
    vez por turno.
    """

    shift_id: UUID
    worker_profile_id: UUID
    status: ApplicationStatus = ApplicationStatus.PENDIENTE

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None


@dataclass(frozen=True)
class EnrichedApplicant:
    """Postulación de un turno junto con los datos del trabajador para la UI.

    Se arma con un único JOIN postulación-trabajador-usuario para evitar el
    2N+1 de pedir `worker`/`user` por cada postulante (ver
    `ShiftApplicationRepository.list_by_shift_enriched` y
    `docs/PERFORMANCE_REPORT.md` P2).
    """

    application_id: UUID
    worker_profile_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    status: ApplicationStatus
    created_at: datetime | None
