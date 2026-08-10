"""Entidades del dominio de favoritos (un comercio marca a un trabajador)."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.worker.domain.value_objects import WorkerSkill


@dataclass(frozen=True)
class Favorite:
    """Marca privada de un comercio sobre un trabajador, para recontratarlo fácil.

    Es un bookmark unidireccional (el comercio la ve, el trabajador no) sin
    ningún efecto sobre reputación, matching ni ninguna otra métrica: no es
    una relación laboral ni una calificación, sólo "quiero encontrar a esta
    persona rápido la próxima vez que publique un turno".
    """

    company_id: UUID
    worker_profile_id: UUID

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None


@dataclass(frozen=True)
class EnrichedFavorite:
    """Favorito junto con los datos del trabajador para la UI del comercio.

    `shifts_together` es una señal derivada (cuántos turnos ya trabajaron
    juntos, contando sólo turnos FINALIZADO/PAGADO) — no una relación de
    empleo ni un dato de reputación del trabajador: es propia de este
    comercio y este trabajador, se arma con una consulta agregada en el
    repositorio (ver `FavoriteRepository.list_by_company`).
    """

    worker_profile_id: UUID
    full_name: str
    photo_url: str | None
    rating: float
    skills: tuple[WorkerSkill, ...]
    is_available: bool
    events_completed: int
    shifts_together: int
    favorited_at: datetime | None
