"""Adaptador SQLAlchemy del NotificationRepository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ws_manager import ws_manager
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.models import NotificationModel


def _to_entity(model: NotificationModel) -> Notification:
    return Notification(
        id=model.id,
        user_id=model.user_id,
        type=NotificationType(model.type),
        title=model.title,
        message=model.message,
        read=model.read,
        created_at=model.created_at,
    )


def _serialize(notification: Notification) -> dict:
    return {
        "id": str(notification.id),
        "type": notification.type.value,
        "title": notification.title,
        "message": notification.message,
        "read": notification.read,
        "created_at": notification.created_at.isoformat()
        if notification.created_at
        else None,
    }


class SqlAlchemyNotificationRepository(NotificationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, notification: Notification) -> Notification:
        model = NotificationModel(
            id=notification.id,
            user_id=notification.user_id,
            type=notification.type.value,
            title=notification.title,
            message=notification.message,
            read=notification.read,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        entity = _to_entity(model)
        await ws_manager.broadcast_notification(entity.user_id, _serialize(entity))
        return entity

    async def list_by_user(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Notification]:
        stmt = (
            select(NotificationModel)
            .where(NotificationModel.user_id == user_id)
            .order_by(NotificationModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def mark_read(self, notification_id: UUID, user_id: UUID) -> Notification | None:
        model = await self._session.get(NotificationModel, notification_id)
        if model is None or model.user_id != user_id:
            return None
        model.read = True
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)
