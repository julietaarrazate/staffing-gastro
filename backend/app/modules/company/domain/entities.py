"""Entidad de dominio PerfilComercio."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.company.domain.value_objects import CompanyCategory


@dataclass
class CompanyProfile:
    """Raíz de agregado PerfilComercio (1:1 con un Usuario de rol employer)."""

    user_id: UUID
    name: str

    # --- Datos del perfil (editables por el comercio) ---
    logo_url: str | None = None
    category: CompanyCategory | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    capacity: int | None = None
    opening_hours: str | None = None

    # --- Métricas (gestionadas por el sistema) ---
    rating: float = 0.0
    events_published: int = 0
    on_time_payment_rate: float = 0.0

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None
