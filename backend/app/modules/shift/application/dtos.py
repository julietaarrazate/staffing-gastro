"""DTOs de la capa de aplicación del módulo shift."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

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
    dress_code: str | None = None
    urgent: bool = False
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    title: str | None = None
    description: str | None = None
