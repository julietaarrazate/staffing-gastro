"""Puerto del repositorio de perfiles de comercio."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.company.domain.entities import CompanyProfile


class CompanyProfileRepository(ABC):
    """Puerto de persistencia para PerfilComercio."""

    @abstractmethod
    async def add(self, profile: CompanyProfile) -> CompanyProfile:
        """Persiste un nuevo perfil y lo devuelve."""

    @abstractmethod
    async def update(self, profile: CompanyProfile) -> CompanyProfile:
        """Actualiza un perfil existente y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, profile_id: UUID) -> CompanyProfile | None:
        """Busca un perfil por su id."""

    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> CompanyProfile | None:
        """Busca el perfil asociado a un usuario."""

    @abstractmethod
    async def exists_by_user_id(self, user_id: UUID) -> bool:
        """Indica si el usuario ya tiene un perfil de comercio."""

    @abstractmethod
    async def update_rating(self, profile_id: UUID, rating: float) -> None:
        """Actualiza el promedio de reputación calculado a partir de las reseñas."""

    @abstractmethod
    async def record_late_cancellation(self, profile_id: UUID) -> None:
        """Registra que el comercio canceló un turno con el trabajador ya
        confirmado (ADR-0007). Incrementa `late_cancellations` en 1. Nunca es
        un UPDATE manual: siempre pasa por acá, disparado por
        `ShiftService.cancel_shift`."""
