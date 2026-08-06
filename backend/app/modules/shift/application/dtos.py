"""DTOs de la capa de aplicación del módulo shift."""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.modules.shift.domain.entities import Shift
from app.modules.worker.domain.value_objects import WorkerSkill


@dataclass
class ShiftData:
    """Datos editables de un turno (alta y edición)."""

    position: WorkerSkill
    quantity: int
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal
    currency: str = "ARS"
    tips: bool = False
    meal: bool = False
    dress_code: str | None = None
    urgent: bool = False
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    title: str | None = None
    description: str | None = None
    # Sólo lo completa `ShiftService.create_event` (publicación masiva); un
    # alta de turno individual nunca los manda.
    event_id: UUID | None = None
    event_name: str | None = None


@dataclass
class EventRoleData:
    """Un rol dentro de una publicación masiva: "necesito 3 mozos a $50000"."""

    position: WorkerSkill
    count: int
    pay_amount: Decimal


@dataclass
class EventData:
    """Datos compartidos de una publicación masiva para un evento (catering,
    boda, etc.): un solo formulario, varios roles, cada uno se publica como
    turno individual (ver `ShiftService.create_event`)."""

    name: str
    start_at: datetime
    end_at: datetime
    roles: list[EventRoleData]
    currency: str = "ARS"
    tips: bool = False
    meal: bool = False
    dress_code: str | None = None
    urgent: bool = False
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None


@dataclass
class EventResult:
    """Resultado de publicar un evento: puede ser parcial si el plan del
    comercio se quedó sin cupo a mitad de camino (`requested` > len(shifts))."""

    event_id: UUID
    requested: int
    shifts: list[Shift] = field(default_factory=list)
