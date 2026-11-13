"""Casos de uso del módulo notification."""

from uuid import UUID

from app.modules.notification.domain.entities import Notification, PushSubscription
from app.modules.notification.domain.exceptions import NotificationNotFoundError
from app.modules.notification.domain.repositories import (
    NotificationRepository,
    PushSubscriptionRepository,
)


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

    async def mark_all_read(self, user_id: UUID) -> int:
        """Marca leídos todos los avisos no leídos del usuario y devuelve
        cuántos eran. Sólo toca los suyos: no hay id que adivinar."""
        return await self._notifications.mark_all_read(user_id)


class PushService:
    """Casos de uso de suscripciones Web Push (alta/baja del dispositivo).

    El envío en sí (best-effort, disparado al crear una notificación in-app)
    vive en `infrastructure/repositories.py::SqlAlchemyNotificationRepository.add`
    — este servicio sólo gestiona el ciclo de vida de la suscripción."""

    def __init__(self, subscriptions: PushSubscriptionRepository) -> None:
        self._subscriptions = subscriptions

    async def subscribe(
        self, user_id: UUID, *, endpoint: str, p256dh_key: str, auth_key: str
    ) -> PushSubscription:
        """Las notificaciones de un dispositivo son de la cuenta que tiene la
        sesión abierta ahí: suscribir un endpoint que ya estaba a nombre de
        otra cuenta lo pasa a `user_id` (antes quedaba con la primera que lo
        activó y la siguiente persona veía sus avisos). Repetirlo para la
        misma cuenta no cambia nada.

        Sólo si llega con las claves que ya tenía, que es lo que manda el
        mismo navegador. Con otras claves no se toca y la respuesta es la
        misma (no-disclosure): si no, alcanzaba con conocer el endpoint de
        otra persona para quedárselo y cortarle los avisos, lo mismo que
        `unsubscribe` cerró para la baja."""
        return await self._subscriptions.add(
            PushSubscription(
                user_id=user_id,
                endpoint=endpoint,
                p256dh_key=p256dh_key,
                auth_key=auth_key,
            )
        )

    async def unsubscribe(self, user_id: UUID, endpoint: str) -> None:
        """No-disclosure/idempotente: no distingue "no existía" de "era de
        otro usuario". Sólo borra la suscripción si es de quien la pide:
        antes alcanzaba con conocer el endpoint de otra persona para cortarle
        los avisos (revisión de seguridad 2026-10-20)."""
        await self._subscriptions.remove_by_endpoint(endpoint, user_id=user_id)
