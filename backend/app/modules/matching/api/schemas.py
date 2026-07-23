"""Esquemas HTTP (Pydantic) del módulo matching."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.worker.domain.value_objects import WorkerSkill


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
