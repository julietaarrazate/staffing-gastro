"""DTOs de la capa de aplicación del módulo worker."""

from dataclasses import dataclass, field
from datetime import date

from app.modules.worker.domain.value_objects import WorkerSkill


@dataclass
class WorkerProfileData:
    """Datos editables del perfil del trabajador (alta y edición)."""

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
