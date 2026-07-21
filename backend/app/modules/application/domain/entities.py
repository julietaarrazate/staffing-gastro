"""Entidades del dominio de postulaciones (un trabajador se postula a un turno)."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.application.domain.exceptions import InvalidApplicationTransitionError
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

    def accept(self) -> None:
        """PENDIENTE → ACEPTADA: el comercio asigna el turno a este postulante.

        Sólo alcanzable desde PENDIENTE (ver `ShiftService.assign_worker`,
        que la busca por turno+trabajador y la acepta si existe; si el
        trabajador fue asignado sin postulación previa, no hay nada que
        transicionar acá)."""
        if self.status != ApplicationStatus.PENDIENTE:
            raise InvalidApplicationTransitionError(
                f"No se puede aceptar una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.ACEPTADA

    def withdraw(self) -> None:
        """PENDIENTE → RETIRADA: el trabajador cancela su propia postulación.

        Sólo alcanzable desde PENDIENTE: una vez que el comercio decidió
        (ACEPTADA/RECHAZADA) la postulación deja de ser del trabajador para
        cancelar. También la usa el auto-retiro cruzado de doble turno (ver
        `ShiftService.confirm_assignment`, que retira postulaciones PENDIENTE
        que se solapan con un turno recién confirmado).
        """
        if self.status != ApplicationStatus.PENDIENTE:
            raise InvalidApplicationTransitionError(
                f"No se puede retirar una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.RETIRADA


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
    is_available: bool
    status: ApplicationStatus
    created_at: datetime | None
