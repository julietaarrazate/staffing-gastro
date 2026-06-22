"""Puerto del repositorio de reseñas."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.review.domain.entities import Review


class ReviewRepository(ABC):
    """Puerto de persistencia para las reseñas."""

    @abstractmethod
    async def add(self, review: Review) -> Review:
        """Persiste una nueva reseña y la devuelve."""

    @abstractmethod
    async def get_by_shift_and_reviewer(
        self, shift_id: UUID, reviewer_user_id: UUID
    ) -> Review | None:
        """Busca la reseña que un usuario ya dejó en un turno, si existe."""

    @abstractmethod
    async def list_by_shift(self, shift_id: UUID) -> list[Review]:
        """Lista las reseñas dejadas en un turno."""

    @abstractmethod
    async def list_received_by_user(self, user_id: UUID) -> list[Review]:
        """Lista las reseñas recibidas por un usuario, de más reciente a más vieja."""

    @abstractmethod
    async def average_rating(self, user_id: UUID) -> float:
        """Promedio de las calificaciones recibidas por un usuario (0.0 si no tiene)."""
