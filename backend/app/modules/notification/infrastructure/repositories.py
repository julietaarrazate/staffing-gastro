"""Adaptadores SQLAlchemy de los repositorios del módulo notification."""

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings as app_settings
from app.core.database import sessions_like
from app.core.ws_manager import ws_manager
from app.modules.notification.domain.entities import Notification, PushSubscription
from app.modules.notification.domain.push_sender import PushSender, PushSendResult
from app.modules.notification.domain.repositories import (
    NotificationRepository,
    PushSubscriptionRepository,
)
from app.modules.notification.domain.value_objects import NotificationType, deep_link_for
from app.modules.notification.infrastructure.models import (
    NotificationModel,
    PushSubscriptionModel,
)
from app.modules.notification.infrastructure.push_tasks import spawn_push_task

logger = logging.getLogger(__name__)


def _to_entity(model: NotificationModel) -> Notification:
    return Notification(
        id=model.id,
        user_id=model.user_id,
        type=NotificationType(model.type),
        title=model.title,
        message=model.message,
        read=model.read,
        link=model.link,
        created_at=model.created_at,
    )


def _serialize(notification: Notification) -> dict:
    return {
        "id": str(notification.id),
        "type": notification.type.value,
        "title": notification.title,
        "message": notification.message,
        "read": notification.read,
        "link": notification.link,
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
            link=notification.link,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        entity = _to_entity(model)
        await ws_manager.broadcast_notification(entity.user_id, _serialize(entity))
        # Best-effort: además del in-app (ws) de arriba, si el usuario tiene
        # algún dispositivo suscripto a Web Push le mandamos push también.
        # Nunca debe romper la creación de la notificación (ver contrato de
        # `PushSender`/docs/reference/ACCESO_MODERNO.md), y el request no
        # espera el envío: sale después de responder (`_schedule_pushes`).
        try:
            await _schedule_pushes(self._session, [entity])
        except Exception:
            logger.exception(
                "Push best-effort: fallo inesperado, no se propaga (user_id=%s)",
                entity.user_id,
            )
        return entity

    async def add_many(self, notifications: list[Notification]) -> list[Notification]:
        if not notifications:
            return []
        # `created_at` se fija acá y no con el default del servidor: así no
        # hace falta releer cada fila después del commit. Antes, avisar un
        # turno nuevo hacía un INSERT, un COMMIT y una relectura por cada
        # trabajador (N+1, medido el 2026-10-22).
        now = datetime.now(timezone.utc)
        models = [
            NotificationModel(
                id=n.id,
                user_id=n.user_id,
                type=n.type.value,
                title=n.title,
                message=n.message,
                read=n.read,
                link=n.link,
                created_at=now,
            )
            for n in notifications
        ]
        self._session.add_all(models)
        await self._session.commit()
        entities = [_to_entity(m) for m in models]
        for entity in entities:
            await ws_manager.broadcast_notification(entity.user_id, _serialize(entity))
        try:
            await _schedule_pushes(self._session, entities)
        except Exception:
            logger.exception("Push best-effort: fallo inesperado en un aviso masivo")
        return entities

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

    async def delete_read_before(self, cutoff: datetime) -> int:
        result = await self._session.execute(
            delete(NotificationModel).where(
                NotificationModel.read.is_(True),
                NotificationModel.created_at < cutoff,
            )
        )
        await self._session.commit()
        return result.rowcount or 0


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

    async def remove_by_endpoint(self, endpoint: str, *, user_id: UUID) -> None:
        stmt = select(PushSubscriptionModel).where(
            PushSubscriptionModel.endpoint == endpoint,
            PushSubscriptionModel.user_id == user_id,
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

    async def list_by_users(self, user_ids: list[UUID]) -> list[PushSubscription]:
        if not user_ids:
            return []
        stmt = select(PushSubscriptionModel).where(PushSubscriptionModel.user_id.in_(user_ids))
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


async def _schedule_pushes(session: AsyncSession, notifications: list[Notification]) -> None:
    """Busca las suscripciones push dentro del request (una consulta, barata)
    y deja los envíos para una tarea de fondo (`push_tasks.spawn_push_task`):
    el request ya no espera los POST al servicio de push, que pueden tardar
    hasta 10 s cada uno. Un solo aviso (`add`) o muchos (`add_many`), igual."""
    by_user = {n.user_id: n for n in notifications}
    subscriptions = await SqlAlchemyPushSubscriptionRepository(session).list_by_users(list(by_user))
    if not subscriptions:
        return
    # El sender se resuelve acá y no en la tarea: es lo que pisan los tests.
    sender = _get_push_sender()
    spawn_push_task(
        _deliver_pushes(
            sender,
            [(s, by_user[s.user_id]) for s in subscriptions],
            sessions_like(session),
        )
    )


async def _deliver_pushes(
    sender: PushSender,
    deliveries: list[tuple[PushSubscription, Notification]],
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    """Corre después de la respuesta. Manda los push en paralelo (cada uno ya
    corre en su hilo, ver `WebPushSender`) y purga las suscripciones que el
    proveedor dio de baja (404/410) con una sesión propia y corta: la del
    request ya está cerrada. Nunca lanza; todo error queda en el log."""
    try:
        results = await asyncio.gather(
            *(
                sender.send(
                    subscription,
                    title=notification.title,
                    body=notification.message,
                    # Destino del push: el enlace concreto del aviso (el turno,
                    # los candidatos de ese turno) y, si no lo tiene, la
                    # pantalla genérica del tipo.
                    url=notification.link or deep_link_for(notification.type),
                )
                for subscription, notification in deliveries
            ),
            return_exceptions=True,
        )
        gone_ids: list[UUID] = []
        for (subscription, notification), result in zip(deliveries, results, strict=True):
            if isinstance(result, BaseException):
                logger.error(
                    "Push: falló el envío, no se reintenta (user_id=%s)",
                    notification.user_id,
                    exc_info=result,
                )
            elif result == PushSendResult.GONE:
                gone_ids.append(subscription.id)
        if gone_ids:
            async with sessions() as cleanup_session:
                await SqlAlchemyPushSubscriptionRepository(cleanup_session).remove_many_by_id(
                    gone_ids
                )
    except Exception:
        logger.exception("Push: fallo inesperado en el envío de fondo")
