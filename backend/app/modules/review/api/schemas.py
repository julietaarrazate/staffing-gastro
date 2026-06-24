"""Esquemas HTTP (Pydantic) del módulo review."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shift_id: UUID
    reviewer_user_id: UUID
    reviewee_user_id: UUID
    rating: int
    comment: str | None
    created_at: datetime


class SubmitReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)
