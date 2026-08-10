"""Esquemas HTTP (Pydantic) del módulo favorite."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.modules.worker.domain.value_objects import WorkerSkill


class FavoriteWorkerResponse(BaseModel):
    """Trabajador favorito, enriquecido con datos del perfil para la UI."""

    worker_profile_id: UUID
    full_name: str
    photo_url: str | None = None
    rating: float = 0.0
    skills: list[WorkerSkill] = []
    is_available: bool = True
    events_completed: int = 0
    shifts_together: int = 0
    favorited_at: datetime | None = None


class FavoriteStatusResponse(BaseModel):
    is_favorite: bool
