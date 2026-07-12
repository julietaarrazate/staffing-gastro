"""Entidad de dominio Turno (Shift).

Encapsula los datos del turno y las reglas de transición de estado del
"Modo Uber". La validación de horario y las transiciones viven en el dominio.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from app.modules.shift.domain.exceptions import (
    InvalidShiftScheduleError,
    InvalidShiftTransitionError,
    OverlappingShiftError,
    ShiftNotEditableError,
)
from app.modules.shift.domain.value_objects import (
    EDITABLE_STATUSES,
    TERMINAL_STATUSES,
    ShiftStatus,
)
from app.modules.worker.domain.value_objects import WorkerSkill


@dataclass
class Shift:
    """Raíz de agregado Turno, publicado por un comercio."""

    company_id: UUID
    position: WorkerSkill
    quantity: int
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal

    currency: str = "ARS"
    tips: bool = False
    dress_code: str | None = None
    urgent: bool = False
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    title: str | None = None
    description: str | None = None

    status: ShiftStatus = ShiftStatus.BORRADOR
    worker_profile_id: UUID | None = None

    check_in_latitude: float | None = None
    check_in_longitude: float | None = None
    check_in_at: datetime | None = None
    check_out_latitude: float | None = None
    check_out_longitude: float | None = None
    check_out_at: datetime | None = None
    paid_at: datetime | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def __post_init__(self) -> None:
        self._validate_schedule()

    def _validate_schedule(self) -> None:
        if self.end_at <= self.start_at:
            raise InvalidShiftScheduleError(
                "El horario de fin debe ser posterior al de inicio"
            )

    @property
    def is_editable(self) -> bool:
        return self.status in EDITABLE_STATUSES

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    def ensure_editable(self) -> None:
        if not self.is_editable:
            raise ShiftNotEditableError(self.status.value)

    def overlaps(self, other: "Shift") -> bool:
        """True si el horario de este turno se solapa con el de `other`.

        Intervalos semiabiertos: si uno termina justo cuando el otro empieza
        no se consideran solapados (un turno puede terminar a las 23 y el
        siguiente empezar a las 23 sin conflicto)."""
        return self.start_at < other.end_at and other.start_at < self.end_at

    # --- Transiciones de estado ---
    def publish(self) -> None:
        """BORRADOR → PUBLICADO."""
        self._transition(ShiftStatus.BORRADOR, ShiftStatus.PUBLICADO)

    def start_searching(self) -> None:
        """PUBLICADO → BUSCANDO_PERSONAL."""
        self._transition(ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL)

    def assign(self, worker_profile_id: UUID) -> None:
        """PUBLICADO/BUSCANDO_PERSONAL → ASIGNADO: el comercio elige un candidato."""
        if self.status not in (ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL):
            raise InvalidShiftTransitionError(
                f"No se puede asignar un turno en estado {self.status.value}"
            )
        self.worker_profile_id = worker_profile_id
        self.status = ShiftStatus.ASIGNADO

    def confirm(self, other_committed_shifts: list["Shift"] | None = None) -> None:
        """ASIGNADO → CONFIRMADO: el trabajador asignado confirma su asistencia.

        Regla de doble turno: antes de confirmar, si el trabajador ya tiene
        otro turno propio en un estado "comprometido" (`COMMITTED_STATUSES`
        — CONFIRMADO, EN_CAMINO o trabajando) cuyo horario se solapa con
        éste, se rechaza la confirmación. `other_committed_shifts` lo arma
        `ShiftService.confirm_assignment` consultando el repo (cruce de
        módulo vía puerto, no vive acá la consulta)."""
        for other in other_committed_shifts or []:
            if self.overlaps(other):
                raise OverlappingShiftError(
                    "Ya tenés un turno confirmado que se superpone con este horario."
                )
        self._transition(ShiftStatus.ASIGNADO, ShiftStatus.CONFIRMADO)

    def reject(self) -> None:
        """ASIGNADO → BUSCANDO_PERSONAL: el trabajador asignado rechaza el turno."""
        if self.status != ShiftStatus.ASIGNADO:
            raise InvalidShiftTransitionError(
                f"No se puede rechazar un turno en estado {self.status.value}"
            )
        self.worker_profile_id = None
        self.status = ShiftStatus.BUSCANDO_PERSONAL

    def cancel(self) -> None:
        """Cancela el turno desde cualquier estado no terminal (comercio, terminal)."""
        if self.is_terminal:
            raise InvalidShiftTransitionError(
                f"No se puede cancelar un turno en estado {self.status.value}"
            )
        self.status = ShiftStatus.CANCELADO

    def worker_cancel(self) -> None:
        """CONFIRMADO → BUSCANDO_PERSONAL: el trabajador cancela su asignación ya
        confirmada (ADR-0004).

        A diferencia de `cancel()` (cancelación del comercio, terminal), esta
        transición **reabre** el turno: el comercio sigue necesitando cubrir el
        puesto, así que vuelve al estado de búsqueda abierta y pierde el
        trabajador asignado. Sólo alcanzable desde `CONFIRMADO` — antes de
        confirmar, el trabajador ya puede `reject()`; después de hacer
        check-in, cancelar sería abandono (fuera de alcance, ver TECH_DEBT.md).
        """
        if self.status != ShiftStatus.CONFIRMADO:
            raise InvalidShiftTransitionError(
                f"No se puede cancelar la asignación desde el estado {self.status.value}"
            )
        self.worker_profile_id = None
        self.status = ShiftStatus.BUSCANDO_PERSONAL

    def depart(self) -> None:
        """CONFIRMADO → EN_CAMINO: el trabajador sale hacia el turno."""
        self._transition(ShiftStatus.CONFIRMADO, ShiftStatus.EN_CAMINO)

    def check_in(self, latitude: float, longitude: float) -> None:
        """EN_CAMINO → CHECK_IN: el trabajador llega y marca su ubicación."""
        self._transition(ShiftStatus.EN_CAMINO, ShiftStatus.CHECK_IN)
        self.check_in_latitude = latitude
        self.check_in_longitude = longitude
        self.check_in_at = datetime.now(timezone.utc)

    def start_working(self) -> None:
        """CHECK_IN → TRABAJANDO: el trabajador empieza su turno."""
        self._transition(ShiftStatus.CHECK_IN, ShiftStatus.TRABAJANDO)

    def check_out(self, latitude: float, longitude: float) -> None:
        """TRABAJANDO → CHECK_OUT: el trabajador termina y marca su ubicación."""
        self._transition(ShiftStatus.TRABAJANDO, ShiftStatus.CHECK_OUT)
        self.check_out_latitude = latitude
        self.check_out_longitude = longitude
        self.check_out_at = datetime.now(timezone.utc)

    def finish(self) -> None:
        """CHECK_OUT → FINALIZADO: cierra el turno trabajado."""
        self._transition(ShiftStatus.CHECK_OUT, ShiftStatus.FINALIZADO)

    def mark_paid(self) -> None:
        """FINALIZADO → PAGADO: el comercio confirma que pagó el turno."""
        self._transition(ShiftStatus.FINALIZADO, ShiftStatus.PAGADO)
        self.paid_at = datetime.now(timezone.utc)

    def _transition(self, expected: ShiftStatus, target: ShiftStatus) -> None:
        if self.status != expected:
            raise InvalidShiftTransitionError(
                f"Transición inválida: {self.status.value} → {target.value}"
            )
        self.status = target
