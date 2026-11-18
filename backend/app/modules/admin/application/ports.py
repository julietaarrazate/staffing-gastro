"""Puertos del módulo admin hacia otras capas."""

from abc import ABC, abstractmethod
from uuid import UUID


class LiveConnectionCloser(ABC):
    """Puerto: cortar las conexiones en vivo (avisos por WebSocket) abiertas de
    una cuenta que se acaba de suspender (ADR-0024)."""

    @abstractmethod
    async def close_for_user(self, user_id: UUID) -> int:
        """Cierra lo que esa persona tenga abierto. Devuelve cuántas conexiones."""
