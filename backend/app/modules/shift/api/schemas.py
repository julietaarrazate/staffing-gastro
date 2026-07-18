"""Esquemas HTTP (Pydantic) del módulo shift."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill


class ShiftInput(BaseModel):
    """Payload de alta/edición de un turno."""

    position: WorkerSkill
    quantity: int = Field(
        default=1,
        ge=1,
        le=1,
        description=(
            "Por ahora, un turno = una persona. Para varios puestos creá "
            "varios turnos (falta multi-asignación, ver R1.4/TECH_DEBT P1)."
        ),
    )
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="ARS", min_length=3, max_length=3)
    tips: bool = False
    dress_code: str | None = Field(default=None, max_length=255)
    urgent: bool = False
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("quantity", mode="before")
    @classmethod
    def _capar_quantity_a_uno(cls, value: object) -> object:
        """Mensaje claro cuando se pide más de un puesto (decisión R1.4).

        `le=1` ya lo rechaza, pero acá damos un detalle en español legible en
        vez del genérico "Input should be less than or equal to 1".
        """
        if isinstance(value, int) and value != 1:
            raise ValueError(
                "Por ahora, un turno = una persona (quantity debe ser 1). "
                "Para cubrir varios puestos, creá varios turnos."
            )
        return value


class ShiftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    position: WorkerSkill
    quantity: int
    start_at: datetime
    end_at: datetime
    pay_amount: Decimal
    currency: str
    tips: bool
    dress_code: str | None
    urgent: bool
    address: str | None
    city: str | None
    latitude: float | None
    longitude: float | None
    title: str | None
    description: str | None
    status: ShiftStatus
    worker_profile_id: UUID | None
    check_in_latitude: float | None
    check_in_longitude: float | None
    check_in_at: datetime | None
    check_out_latitude: float | None
    check_out_longitude: float | None
    check_out_at: datetime | None
    paid_at: datetime | None
    created_at: datetime | None = None
    company_name: str | None = None
    company_logo_url: str | None = None


class ShiftPublicResponse(BaseModel):
    """Vista pública de un turno (sin autenticación), para compartir por
    WhatsApp/redes. Sólo campos seguros: nada de contacto del comercio,
    postulantes, ni ids internos más allá del propio turno."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    position: WorkerSkill
    start_at: datetime
    end_at: datetime
    city: str | None
    pay_amount: Decimal
    currency: str
    company_name: str | None = None


class AssignWorkerRequest(BaseModel):
    """Payload para asignar el turno a un candidato."""

    worker_profile_id: UUID


class GeoCheckRequest(BaseModel):
    """Payload de check-in/check-out con la ubicación del trabajador."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
