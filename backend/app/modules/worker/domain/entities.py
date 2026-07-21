"""Entidad de dominio PerfilTrabajador.

Modela el perfil de un trabajador de forma pura (sin ORM ni HTTP).
Las métricas e insignias son gestionadas por el sistema, no editables por el usuario.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from uuid import UUID, uuid4

from app.modules.worker.domain.value_objects import (
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)


@dataclass
class WorkerProfile:
    """Raíz de agregado PerfilTrabajador (1:1 con un Usuario de rol worker)."""

    user_id: UUID

    # --- Datos del perfil (editables por el trabajador) ---
    photo_url: str | None = None
    birth_date: date | None = None
    city: str | None = None
    bio: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    skills: list[WorkerSkill] = field(default_factory=list)
    years_experience: int = 0
    languages: list[str] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)
    cv_url: str | None = None
    is_available: bool = True

    # --- Métricas (gestionadas por el sistema) ---
    rating: float = 0.0
    events_completed: int = 0
    punctuality_rate: float = 0.0
    cancellations: int = 0
    # No-show (Parte C, PRIMER_TURNO_REAL_SPEC / ADR-0007): distinto de
    # `cancellations` (el trabajador avisa antes de que el comercio lo
    # necesite) — acá el trabajador quedó CONFIRMADO/EN_CAMINO y el comercio
    # lo marcó manualmente como no presentado. Señal más grave, se pondera
    # aparte (ver `matching/domain/scoring.py` y `worker/domain/rules.py`).
    no_shows: int = 0
    badges: list[WorkerBadge] = field(default_factory=list)
    level: GamificationLevel = GamificationLevel.BRONCE

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def age(self) -> int | None:
        """Edad calculada a partir de la fecha de nacimiento."""
        if self.birth_date is None:
            return None
        today = date.today()
        return (
            today.year
            - self.birth_date.year
            - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        )
