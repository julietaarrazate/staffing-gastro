"""Casos de uso del módulo notification."""

from uuid import UUID

from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.exceptions import NotificationNotFoundError
from app.modules.notification.domain.repositories import NotificationRepository


class NotificationService:
    """Servicio de aplicación para gestionar notificaciones in-app."""

    def __init__(self, notifications: NotificationRepository) -> None:
        self._notifications = notifications

    async def list_mine(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Notification]:
        return await self._notifications.list_by_user(user_id, limit=limit, offset=offset)

    async def mark_read(self, user_id: UUID, notification_id: UUID) -> Notification:
        notification = await self._notifications.mark_read(notification_id, user_id)
        if notification is None:
            raise NotificationNotFoundError(str(notification_id))
        return notification
