"""Adaptadores SQLAlchemy de los repositorios del módulo notification."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.ws_manager import ws_manager
from app.modules.notification.domain.entities import Notification, PushSubscription
from app.modules.notification.domain.push_sender import PushSendResult, PushSender
from app.modules.notification.domain.repositories import (
    NotificationRepository,
    PushSubscriptionRepository,
)
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.models import (
    NotificationModel,
    PushSubscriptionModel,
)

logger = logging.getLogger(__name__)


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
        # Best-effort: además del in-app (ws) de arriba, si el usuario tiene
        # algún dispositivo suscripto a Web Push le mandamos push también.
        # Nunca debe romper la creación de la notificación (ver contrato de
        # `PushSender`/docs/ACCESO_MODERNO.md).
        try:
            await _send_push_best_effort(self._session, entity)
        except Exception:
            logger.exception(
                "Push best-effort: fallo inesperado, no se propaga (user_id=%s)",
                entity.user_id,
            )
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


def _push_to_entity(model: PushSubscriptionModel) -> PushSubscription:
    return PushSubscription(
        id=model.id,
        user_id=model.user_id,
        endpoint=model.endpoint,
        p256dh_key=model.p256dh_key,
        auth_key=model.auth_key,
        created_at=model.created_at,
    )


class SqlAlchemyPushSubscriptionRepository(PushSubscriptionRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, subscription: PushSubscription) -> PushSubscription:
        stmt = select(PushSubscriptionModel).where(
            PushSubscriptionModel.endpoint == subscription.endpoint
        )
        result = await self._session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing is not None:
            # Idempotente: el mismo endpoint ya está suscripto (p. ej. el
            # usuario tocó "Activar" dos veces, o reinstaló la PWA con el
            # mismo service worker todavía registrado).
            return _push_to_entity(existing)

        model = PushSubscriptionModel(
            id=subscription.id,
            user_id=subscription.user_id,
            endpoint=subscription.endpoint,
            p256dh_key=subscription.p256dh_key,
            auth_key=subscription.auth_key,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _push_to_entity(model)

    async def remove_by_endpoint(self, endpoint: str) -> None:
        stmt = select(PushSubscriptionModel).where(
            PushSubscriptionModel.endpoint == endpoint
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is not None:
            await self._session.delete(model)
            await self._session.commit()

    async def list_by_user(self, user_id: UUID) -> list[PushSubscription]:
        stmt = select(PushSubscriptionModel).where(PushSubscriptionModel.user_id == user_id)
        result = await self._session.execute(stmt)
        return [_push_to_entity(m) for m in result.scalars().all()]

    async def remove_many_by_id(self, subscription_ids: list[UUID]) -> None:
        if not subscription_ids:
            return
        stmt = select(PushSubscriptionModel).where(
            PushSubscriptionModel.id.in_(subscription_ids)
        )
        result = await self._session.execute(stmt)
        for model in result.scalars().all():
            await self._session.delete(model)
        await self._session.commit()


def _get_push_sender() -> PushSender:
    """Flag por ausencia (mismo patrón que `get_email_sender`): sin ambas
    claves VAPID configuradas, `NullPushSender` (no-op). Función privada,
    pensada para poder pisarse con `monkeypatch` en tests que necesiten
    forzar un envío real/fallido sin credenciales verdaderas."""
    if app_settings.vapid_public_key and app_settings.vapid_private_key:
        from app.modules.notification.infrastructure.webpush_sender import WebPushSender

        return WebPushSender(app_settings)
    from app.modules.notification.infrastructure.null_push_sender import NullPushSender

    return NullPushSender()


async def _send_push_best_effort(session: AsyncSession, notification: Notification) -> None:
    push_repo = SqlAlchemyPushSubscriptionRepository(session)
    subscriptions = await push_repo.list_by_user(notification.user_id)
    if not subscriptions:
        return

    sender = _get_push_sender()
    gone_ids: list[UUID] = []
    for subscription in subscriptions:
        result = await sender.send(
            subscription, title=notification.title, body=notification.message
        )
        if result == PushSendResult.GONE:
            gone_ids.append(subscription.id)

    if gone_ids:
        await push_repo.remove_many_by_id(gone_ids)
