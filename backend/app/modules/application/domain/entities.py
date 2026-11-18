"""Entidades del dominio de postulaciones (un trabajador se postula a un turno)."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.modules.application.domain.exceptions import InvalidApplicationTransitionError
from app.modules.application.domain.value_objects import (
    ApplicationStatus,
    MotivoDesasignacion,
)
from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge


# Estados desde los que el comercio puede asignarle el turno a la persona
# (`ShiftApplication.accept`).
ASSIGNABLE_FROM = frozenset(
    {
        ApplicationStatus.PENDIENTE,
        ApplicationStatus.DESASIGNADA,
        ApplicationStatus.RETIRADA,
    }
)


@dataclass
class ShiftApplication:
    """Manifestación de interés de un trabajador por un turno abierto.

    Es el lado "trabajador" del match: el trabajador se postula
    (PENDIENTE) y el comercio puede asignarle el turno (lo que la marca como
    ACEPTADA) o seguir con otro candidato. Hay una sola postulación por
    (turno, trabajador): quien la retiró y vuelve a postularse reactiva la
    misma (`reapply`), no crea otra.

    Si quien tenía el turno asignado lo deja (rechaza, cancela o no se
    presenta), su postulación pasa a DESASIGNADA con el motivo: el comercio la
    sigue viendo, al final y con su marca, y puede volver a asignarle el turno
    (`accept`). Quien fue asignado sin haberse postulado no tenía fila: se
    crea una ya DESASIGNADA (`unassigned`), para que el hecho quede escrito.
    """

    shift_id: UUID
    worker_profile_id: UUID
    status: ApplicationStatus = ApplicationStatus.PENDIENTE

    id: UUID = field(default_factory=uuid4)
    # Fecha de la postulación vigente: la pone la base al crearla y la renueva
    # `reapply()` cuando el trabajador vuelve a postularse.
    created_at: datetime | None = None
    # Sólo con status DESASIGNADA (y siempre con él): por qué dejó el turno.
    motivo: MotivoDesasignacion | None = None

    def __post_init__(self) -> None:
        if (self.status == ApplicationStatus.DESASIGNADA) != (self.motivo is not None):
            raise ValueError(
                "El motivo va con una postulación desasignada, y sólo con ella"
            )

    @classmethod
    def unassigned(
        cls, shift_id: UUID, worker_profile_id: UUID, motivo: MotivoDesasignacion
    ) -> "ShiftApplication":
        """Fila para quien fue asignado SIN postularse (desde «Recomendados»
        o la búsqueda) y dejó el turno: nace DESASIGNADA, con su motivo."""
        return cls(
            shift_id=shift_id,
            worker_profile_id=worker_profile_id,
            status=ApplicationStatus.DESASIGNADA,
            motivo=motivo,
        )

    def accept(self) -> None:
        """→ ACEPTADA: el comercio asigna el turno a esta persona.

        Desde PENDIENTE (lo normal), desde DESASIGNADA (el comercio vuelve a
        elegir a quien había rechazado, cancelado o faltado; se borra el
        motivo) o desde RETIRADA (el comercio la asigna desde «Recomendados»
        aunque había retirado su postulación). Una RECHAZADA no: sólo existe
        mientras el turno es de otra persona, y ahí no se puede asignar. Ver
        `ShiftService.assign_worker`; si la persona fue asignada sin
        postulación previa, no hay nada que transicionar acá."""
        if self.status not in ASSIGNABLE_FROM:
            raise InvalidApplicationTransitionError(
                f"No se puede aceptar una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.ACEPTADA
        self.motivo = None

    def unassign(self, motivo: MotivoDesasignacion) -> None:
        """ACEPTADA → DESASIGNADA: quien tenía el turno lo rechazó, canceló
        después de confirmar o no se presentó (`motivo`).

        La persona no desaparece de la lista del comercio: queda al final,
        con su marca, y se le puede volver a asignar (`accept`). No puede
        postularse otra vez por su cuenta (`ApplicationService.apply`): ya
        está en la lista, y la decisión de volver a elegirla es del comercio.
        Ver `ShiftService._mark_unassigned`."""
        if self.status != ApplicationStatus.ACEPTADA:
            raise InvalidApplicationTransitionError(
                f"No se puede desasignar una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.DESASIGNADA
        self.motivo = motivo

    def release(self) -> None:
        """ACEPTADA → PENDIENTE: el turno se le soltó sin que lo decidiera
        ella ni el comercio (suspensión de su cuenta, ADR-0024).

        No deja marca: mientras la cuenta está suspendida la lista no la
        muestra, y si se reactiva vuelve a estar en carrera como cualquier
        postulante. Ver `ShiftService._reopen_for_worker_suspension`."""
        if self.status != ApplicationStatus.ACEPTADA:
            raise InvalidApplicationTransitionError(
                f"No se puede soltar una postulación en estado {self.status.value}"
            )
        self.status = ApplicationStatus.PENDIENTE

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
        por `restore()`, cuando el turno se reabre. Una DESASIGNADA tampoco:
        la persona sigue en la lista del comercio, que decide si la vuelve a
        elegir. La fecha se renueva: para
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
    # Por qué dejó el turno, si lo tuvo asignado (sólo con DESASIGNADA).
    motivo: MotivoDesasignacion | None = None
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
    # Dueño del perfil: la API lo usa para pedir, de una vez, quiénes tienen la
    # identidad verificada (no sale en la respuesta).
    user_id: UUID | None = None
