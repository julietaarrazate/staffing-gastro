"""Puerto del repositorio de postulaciones."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.application.domain.entities import EnrichedApplicant, ShiftApplication


class ShiftApplicationRepository(ABC):
    """Puerto de persistencia para las postulaciones."""

    @abstractmethod
    async def add(self, application: ShiftApplication) -> ShiftApplication:
        """Persiste una nueva postulación y la devuelve."""

    @abstractmethod
    async def update(self, application: ShiftApplication) -> ShiftApplication:
        """Actualiza una postulación existente y la devuelve."""

    @abstractmethod
    async def get_by_shift_and_worker(
        self, shift_id: UUID, worker_profile_id: UUID
    ) -> ShiftApplication | None:
        """Busca la postulación de un trabajador a un turno, si existe."""

    @abstractmethod
    async def list_by_shift(self, shift_id: UUID) -> list[ShiftApplication]:
        """Lista las postulaciones a un turno (más recientes primero)."""

    @abstractmethod
    async def list_by_worker(
        self, worker_profile_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[ShiftApplication]:
        """Lista las postulaciones de un trabajador (más recientes primero, paginado)."""

    @abstractmethod
    async def list_by_shift_enriched(self, shift_id: UUID) -> list[EnrichedApplicant]:
        """Postulantes de un turno con datos del trabajador (perfil + usuario),
        en pocas consultas (JOIN) en vez de 2 por postulante."""
