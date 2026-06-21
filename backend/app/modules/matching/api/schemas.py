"""Esquemas HTTP (Pydantic) del módulo matching."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CandidateMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile_id: UUID
    user_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    score: float
    distance_km: float | None
