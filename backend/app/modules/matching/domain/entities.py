"""Entidades y DTOs puros del dominio de matching.

El motor de matching no depende de las entidades de `worker`/`shift`: recibe
estos objetos livianos, que la capa de aplicación construye a partir de ellas.
Esto mantiene el cálculo del score testeable de forma aislada.
"""

from dataclasses import dataclass
from uuid import UUID

from app.modules.worker.domain.value_objects import WorkerSkill


@dataclass(frozen=True)
class CandidateProfile:
    """Datos del trabajador relevantes para calcular el score de matching."""

    profile_id: UUID
    user_id: UUID
    full_name: str
    photo_url: str | None
    skills: tuple[WorkerSkill, ...]
    years_experience: int
    rating: float
    punctuality_rate: float
    events_completed: int
    cancellations: int
    is_available: bool
    latitude: float | None
    longitude: float | None


@dataclass(frozen=True)
class ShiftRequirement:
    """Datos del turno relevantes para calcular el score de matching."""

    position: WorkerSkill
    latitude: float | None
    longitude: float | None


@dataclass(frozen=True)
class MatchResult:
    """Resultado del matching para un candidato: score total y su desglose."""

    profile_id: UUID
    user_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    score: float
    distance_km: float | None
