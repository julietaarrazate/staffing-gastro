"""Puerto del repositorio de turnos guardados."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.saved_shift.domain.entities import SavedShift


class SavedShiftRepository(ABC):
    """Puerto de persistencia para SavedShift."""

    @abstractmethod
    async def add(self, saved: SavedShift) -> SavedShift:
        """Persiste un nuevo turno guardado y lo devuelve."""

    @abstractmethod
    async def remove(self, worker_profile_id: UUID, shift_id: UUID) -> None:
        """Elimina el guardado si existe (no-op si no existe: idempotente)."""

    @abstractmethod
    async def get_by_worker_and_shift(
        self, worker_profile_id: UUID, shift_id: UUID
    ) -> SavedShift | None:
        """Busca el guardado de un trabajador sobre un turno, si existe."""

    @abstractmethod
    async def list_shift_ids_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[UUID]:
        """Ids de los turnos guardados por un trabajador, más recientes
        primero (el orden real por fecha del turno lo arma el service, que
        resuelve los `Shift` completos vía el puerto de `shift`)."""
