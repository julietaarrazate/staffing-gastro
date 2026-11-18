"""Puertos del módulo notification hacia otros módulos."""

from abc import ABC, abstractmethod
from uuid import UUID


class SessionRevocations(ABC):
    """Puerto: preguntarle a identity qué cuentas se quedaron sin sesión
    porque sus sesiones se revocaron (cerró sesión, restableció la
    contraseña, la suspendieron, se reutilizó un refresh). Lo usa el barrido
    de dispositivos (`PushService`).

    Una cuenta cuya sesión sólo venció por no abrir la app NO entra: su
    dispositivo sigue registrado hasta que se abre la app ahí."""

    @abstractmethod
    async def ended_by_revocation(self, user_ids: list[UUID]) -> set[UUID]:
        """De `user_ids`, las cuentas que no tienen ninguna sesión viva y
        cuya sesión más reciente terminó revocada."""
