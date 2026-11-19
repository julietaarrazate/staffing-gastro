"""DTOs de la capa de aplicación del módulo worker."""

from dataclasses import dataclass, field
from datetime import date

from app.modules.worker.domain.value_objects import CvFile, WorkerSkill


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
    # El CV subido (privado) o un link pegado a mano; el archivo gana.
    cv_file: CvFile | None = None
    cv_url: str | None = None
    cv_filename: str | None = None
    is_available: bool = True
    # Pedido que trae `cv_url` pero no `cv_file`: una versión vieja de la app
    # (PWA en caché) que no conoce el campo. Sin un link nuevo, el archivo
    # que ya está se conserva: si no, cambiar la foto desde esa versión
    # borraba el CV.
    keep_cv_file: bool = False
