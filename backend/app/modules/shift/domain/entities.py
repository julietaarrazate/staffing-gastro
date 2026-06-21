"""Entidad de dominio Turno (Shift).

Encapsula los datos del turno y las reglas de transición de estado del
"Modo Uber". La validación de horario y las transiciones viven en el dominio.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from app.modules.shift.domain.exceptions import (
    InvalidShiftScheduleError,
    InvalidShiftTransitionError,
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

    # --- Transiciones de estado ---
    def publish(self) -> None:
        """BORRADOR → PUBLICADO."""
        self._transition(ShiftStatus.BORRADOR, ShiftStatus.PUBLICADO)

    def start_searching(self) -> None:
        """PUBLICADO → BUSCANDO_PERSONAL."""
        self._transition(ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL)

    def cancel(self) -> None:
        """Cancela el turno desde cualquier estado no terminal."""
        if self.is_terminal:
            raise InvalidShiftTransitionError(
                f"No se puede cancelar un turno en estado {self.status.value}"
            )
        self.status = ShiftStatus.CANCELADO

    def _transition(self, expected: ShiftStatus, target: ShiftStatus) -> None:
        if self.status != expected:
            raise InvalidShiftTransitionError(
                f"Transición inválida: {self.status.value} → {target.value}"
            )
        self.status = target
