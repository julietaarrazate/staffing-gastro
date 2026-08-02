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
    # `events_published` se incrementa al publicar un turno
    # (`ShiftService.publish_shift`); `on_time_payment_rate` es un promedio
    # móvil sobre si `mark_paid` ocurrió a tiempo respecto de `end_at`
    # (`ShiftService.mark_paid`) — antes ninguna de las dos se calculaba
    # sola, quedaban en 0 para siempre (ver docs/REPUTATION.md).
    events_published: int = 0
    on_time_payment_rate: float = 0.0
    # Contador interno para ponderar el promedio de `on_time_payment_rate`
    # (no es `events_published`: no todo turno publicado llega a pagarse).
    # No se expone en la API, sólo lo usa el repositorio.
    payments_recorded: int = 0
    # Cancelación tardía (Parte C, PRIMER_TURNO_REAL_SPEC / ADR-0007):
    # cuenta las veces que el comercio canceló un turno con el trabajador ya
    # CONFIRMADO (o más adelante en el ciclo) — efecto simétrico al
    # `no_shows`/`cancellations` del trabajador.
    late_cancellations: int = 0

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None
