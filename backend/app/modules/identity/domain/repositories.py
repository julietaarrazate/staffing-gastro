"""Puerto del repositorio de usuarios (arquitectura hexagonal).

Define el contrato que la capa de aplicación necesita. Las implementaciones
concretas (adaptadores) viven en la capa de infraestructura.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.identity.domain.entities import User


class UserRepository(ABC):
    """Puerto de persistencia para la entidad Usuario."""

    @abstractmethod
    async def add(self, user: User) -> User:
        """Persiste un nuevo usuario y lo devuelve."""

    @abstractmethod
    async def update(self, user: User) -> User:
        """Actualiza un usuario existente (rol, estado, verificación) y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None:
        """Busca un usuario por su id."""

    @abstractmethod
    async def list_all(self) -> list[User]:
        """Lista todos los usuarios (más recientes primero)."""

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        """Busca un usuario por su email (case-insensitive)."""

    @abstractmethod
    async def exists_by_email(self, email: str) -> bool:
        """Indica si ya existe un usuario con ese email."""
