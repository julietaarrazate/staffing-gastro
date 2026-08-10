"""Casos de uso del módulo favorite (el comercio marca trabajadores para recontratar)."""

from uuid import UUID

from app.modules.favorite.domain.entities import EnrichedFavorite, Favorite
from app.modules.favorite.domain.exceptions import WorkerNotFavoritableError
from app.modules.favorite.domain.repositories import FavoriteRepository
from app.modules.worker.domain.repositories import WorkerProfileRepository


class FavoriteService:
    """Marcar/desmarcar trabajadores como favoritos y listar los propios.

    Es un bookmark privado del comercio, sin ningún efecto sobre reputación,
    matching ni otras métricas del trabajador (ver auditoría de producto,
    docs/STATUS.md 2026-08-10).
    """

    def __init__(
        self, favorites: FavoriteRepository, workers: WorkerProfileRepository
    ) -> None:
        self._favorites = favorites
        self._workers = workers

    async def mark(self, company_id: UUID, worker_profile_id: UUID) -> Favorite:
        """Marca a un trabajador como favorito. Idempotente: si ya estaba
        marcado, devuelve el favorito existente en vez de duplicar."""
        worker = await self._workers.get_by_id(worker_profile_id)
        if worker is None:
            raise WorkerNotFavoritableError(str(worker_profile_id))

        existing = await self._favorites.get_by_company_and_worker(
            company_id, worker_profile_id
        )
        if existing is not None:
            return existing
        return await self._favorites.add(
            Favorite(company_id=company_id, worker_profile_id=worker_profile_id)
        )

    async def unmark(self, company_id: UUID, worker_profile_id: UUID) -> None:
        """Desmarca a un trabajador. Idempotente: no falla si no estaba marcado."""
        await self._favorites.remove(company_id, worker_profile_id)

    async def list_my_favorites(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[EnrichedFavorite]:
        """Lista los trabajadores favoritos del comercio, más recientes primero."""
        return await self._favorites.list_by_company(company_id, limit=limit, offset=offset)

    async def is_favorite(self, company_id: UUID, worker_profile_id: UUID) -> bool:
        """Indica si el trabajador ya está marcado como favorito por este comercio."""
        existing = await self._favorites.get_by_company_and_worker(
            company_id, worker_profile_id
        )
        return existing is not None
