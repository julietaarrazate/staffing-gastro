"""Puertos del módulo identity hacia otras capas."""

from abc import ABC, abstractmethod
from uuid import UUID


class LiveConnectionCloser(ABC):
    """Puerto: cortar las conexiones en vivo (avisos y chat por WebSocket)
    abiertas de una cuenta a la que se le revocaron todas las sesiones
    (contraseña nueva, reclamo por Google, alta de dos pasos).

    Un socket autoriza sólo al conectarse: sin este corte seguiría entregando
    lo de la cuenta hasta que venza su token (PRI-04)."""

    @abstractmethod
    async def close_for_user(self, user_id: UUID) -> int:
        """Cierra lo que esa persona tenga abierto. Devuelve cuántas conexiones."""
