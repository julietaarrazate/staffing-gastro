"""Esquemas HTTP (Pydantic) del módulo matching."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.worker.domain.value_objects import GamificationLevel, WorkerBadge, WorkerSkill


class CandidateMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile_id: UUID
    user_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    score: float
    distance_km: float | None
    events_completed: int
    punctuality_rate: float
    years_experience: int
    badges: list[WorkerBadge] = []
    level: GamificationLevel = GamificationLevel.BRONCE
    # Identidad (EPIC-001, ADR-0010): lo que el comercio ve del candidato. Se
    # enriquece en el route vía el servicio de verificación; nunca son evidencias.
    identidad_verificada: bool = False


class WorkerMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile_id: UUID
    user_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    skills: list[WorkerSkill]
    latitude: float | None
    longitude: float | None
    distance_km: float | None
