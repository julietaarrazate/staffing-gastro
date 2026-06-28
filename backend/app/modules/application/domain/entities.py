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
