"""Puerto del repositorio de notificaciones."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.notification.domain.entities import Notification


class NotificationRepository(ABC):
    """Puerto de persistencia para Notificación."""

    @abstractmethod
    async def add(self, notification: Notification) -> Notification:
        """Persiste una nueva notificación y la devuelve."""

    @abstractmethod
    async def list_by_user(self, user_id: UUID) -> list[Notification]:
        """Lista las notificaciones de un usuario (más recientes primero)."""

    @abstractmethod
    async def mark_read(self, notification_id: UUID, user_id: UUID) -> Notification | None:
        """Marca como leída una notificación propia del usuario.

        Devuelve None si no existe o no pertenece al usuario (no-disclosure).
        """
