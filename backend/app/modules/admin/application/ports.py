"""Puertos del módulo admin hacia otras capas."""

from abc import ABC, abstractmethod
from uuid import UUID


class LiveConnectionCloser(ABC):
    """Puerto: cortar las conexiones en vivo (avisos por WebSocket) abiertas de
    una cuenta que se acaba de suspender (ADR-0024)."""

    @abstractmethod
    async def close_for_user(self, user_id: UUID) -> int:
        """Cierra lo que esa persona tenga abierto. Devuelve cuántas conexiones."""


class AccountDeviceRemover(ABC):
    """Puerto: borrar los dispositivos registrados para los avisos push de una
    cuenta que se acaba de suspender (ADR-0024). Reactivarla no los restaura:
    cada dispositivo se vuelve a registrar solo en el próximo ingreso."""

    @abstractmethod
    async def remove_for_user(self, user_id: UUID) -> int:
        """Borra todos los dispositivos de esa cuenta. Devuelve cuántos eran."""
