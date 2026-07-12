"""Puerto del repositorio de turnos."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill


class ShiftRepository(ABC):
    """Puerto de persistencia para Turno."""

    @abstractmethod
    async def add(self, shift: Shift) -> Shift:
        """Persiste un nuevo turno y lo devuelve."""

    @abstractmethod
    async def update(self, shift: Shift) -> Shift:
        """Actualiza un turno existente y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, shift_id: UUID) -> Shift | None:
        """Busca un turno por su id."""

    @abstractmethod
    async def list_by_company(
        self, company_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        """Lista los turnos publicados por un comercio (más recientes primero, paginado)."""

    @abstractmethod
    async def list_open(
        self,
        *,
        city: str | None = None,
        position: WorkerSkill | None = None,
        urgent: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Shift]:
        """Lista los turnos abiertos del feed público, con filtros opcionales (paginado)."""

    @abstractmethod
    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Shift]:
        """Lista los turnos asignados a un trabajador (más recientes primero, paginado)."""

    @abstractmethod
    async def list_by_worker_and_statuses(
        self, worker_profile_id: UUID, statuses: frozenset[ShiftStatus]
    ) -> list[Shift]:
        """Turnos de un trabajador en alguno de los estados dados, sin paginar.

        Uso interno (no expuesto por API): detectar solapamiento de horarios
        al confirmar un turno (regla de doble turno, `COMMITTED_STATUSES`)."""
