"""Puerto del repositorio de favoritos."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.favorite.domain.entities import EnrichedFavorite, Favorite


class FavoriteRepository(ABC):
    """Puerto de persistencia para Favorito."""

    @abstractmethod
    async def add(self, favorite: Favorite) -> Favorite:
        """Persiste un nuevo favorito y lo devuelve."""

    @abstractmethod
    async def remove(self, company_id: UUID, worker_profile_id: UUID) -> None:
        """Elimina el favorito si existe (no-op si no existe: idempotente)."""

    @abstractmethod
    async def get_by_company_and_worker(
        self, company_id: UUID, worker_profile_id: UUID
    ) -> Favorite | None:
        """Busca el favorito de un comercio sobre un trabajador, si existe."""

    @abstractmethod
    async def list_by_company(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[EnrichedFavorite]:
        """Lista los favoritos de un comercio (más recientes primero, paginado),
        ya enriquecidos con los datos del trabajador y `shifts_together`."""
