"""Entidades del dominio de reseñas (calificación bidireccional por turno)."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class Review:
    """Una calificación que un participante de un turno le deja al otro.

    El turno define quién califica a quién: comercio y trabajador asignado
    se califican mutuamente una vez que el turno está cerrado (FINALIZADO o
    PAGADO). Cada uno puede dejar una sola reseña por turno.
    """

    shift_id: UUID
    reviewer_user_id: UUID
    reviewee_user_id: UUID
    rating: int
    comment: str | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
