"""Esquemas HTTP (Pydantic) del módulo matching."""

from uuid import UUID

from pydantic import BaseModel


class CandidateMatchResponse(BaseModel):
    profile_id: UUID
    user_id: UUID
    score: float
    distance_km: float | None
