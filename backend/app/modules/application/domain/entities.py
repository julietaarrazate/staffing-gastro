"""Entidades del dominio de postulaciones (un trabajador se postula a un turno)."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.modules.application.domain.exceptions import InvalidApplicationTransitionError
from app.modules.application.domain.value_objects import ApplicationStatus
from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge


@dataclass
class ShiftApplication:
    """Manifestación de interés de un trabajador por un turno abierto.

    Es el lado "trabajador" del match: el trabajador se postula
    (PENDIENTE) y el comercio puede asignarle el turno (lo que la marca como
    ACEPTADA) o seguir con otro candidato. Hay una sola postulación por
    (turno, trabajador): quien la retiró y vuelve a postularse reactiva la
    misma (`reapply`), no crea otra.
    """

    shift_id: UUID
    worker_profile_id: UUID
    status: ApplicationStatus = ApplicationStatus.PENDIENTE

    id: UUID = field(default_factory=uuid4)
    # Fecha de la postulación vigente: la pone la base al crearla y la renueva
    # `reapply()` cuando el trabajador vuelve a postularse.
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

    def reject(self) -> None:
        """PENDIENTE → RECHAZADA: el comercio eligió a otro candidato (o canceló
        el turno), así que este postulante quedó afuera.

        Sólo alcanzable desde PENDIENTE. La postulación del elegido va por
        `accept()`, nunca por acá (ver `ShiftService._reject_pending_applicants`,
        TECH_DEBT P5). RECHAZADA no la escribe ningún otro camino, por lo que es
        reversible sin ambigüedad con `restore()` cuando el turno se reabre."""
        if self.status != ApplicationStatus.PENDIENTE:
            raise InvalidApplicationTransitionError(
                f"No se puede rechazar una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.RECHAZADA

    def restore(self) -> None:
        """RECHAZADA → PENDIENTE: el turno se reabrió (el asignado lo rechazó,
        canceló o no se presentó) y los candidatos que habían quedado afuera al
        asignar vuelven a estar en carrera.

        Sólo alcanzable desde RECHAZADA (ver
        `ShiftService._restore_rejected_applicants`)."""
        if self.status != ApplicationStatus.RECHAZADA:
            raise InvalidApplicationTransitionError(
                f"No se puede reabrir una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.PENDIENTE

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

    def reapply(self) -> None:
        """RETIRADA → PENDIENTE: el trabajador vuelve a postularse al turno.

        Sólo alcanzable desde RETIRADA, que es el único estado que decide el
        trabajador (o el auto-retiro por doble turno, que actúa en su nombre).
        Una RECHAZADA es decisión del comercio y vuelve a PENDIENTE únicamente
        por `restore()`, cuando el turno se reabre. La fecha se renueva: para
        el comercio es una postulación nueva. Que el turno siga abierto lo
        chequea `ApplicationService.apply`."""
        if self.status != ApplicationStatus.RETIRADA:
            raise InvalidApplicationTransitionError(
                f"No se puede volver a postular una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.PENDIENTE
        self.created_at = datetime.now(timezone.utc)


@dataclass(frozen=True)
class ApplicantMatch:
    """Resultado de buscar, entre los postulantes de un comercio, uno cuyo
    nombre coincide con lo que preguntó el asistente de IA (ver
    `ShiftApplicationRepository.find_applicant_by_name`). `user_id` es lo
    que necesita `VerificationService` — `Claim` se indexa por usuario, no
    por perfil de trabajador."""

    user_id: UUID
    full_name: str


@dataclass(frozen=True)
class EnrichedApplicant:
    """Postulación de un turno junto con los datos del trabajador para la UI.

    Se arma con un único JOIN postulación-trabajador-usuario para evitar el
    2N+1 de pedir `worker`/`user` por cada postulante (ver
    `ShiftApplicationRepository.list_by_shift_enriched` y
    `docs/audits/PERFORMANCE_REPORT.md` P2).
    """

    application_id: UUID
    worker_profile_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    is_available: bool
    status: ApplicationStatus
    created_at: datetime | None
    # Señales de confianza para la lista de postulantes del comercio (mismas
    # que las de los recomendados): ya vienen del JOIN a worker_profiles, sin
    # consulta extra.
    events_completed: int = 0
    punctuality_rate: float = 0.0
    years_experience: int = 0
    # F1 (auditoría de producto 2026-08-10): mismas señales de reputación que
    # ya se muestran en /workers/[id] (ADR-0004), ahora también visibles en
    # la lista de postulantes — el comercio elige con más contexto, sin que
    # esto altere el orden (la lista de postulantes no se rankea).
    badges: tuple[WorkerBadge, ...] = ()
    level: GamificationLevel = GamificationLevel.BRONCE
