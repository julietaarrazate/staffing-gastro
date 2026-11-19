"""Casos de uso del módulo notification."""

from collections.abc import Collection
from uuid import UUID

from app.modules.notification.application.ports import SessionRevocations
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

    async def mark_all_read(self, user_id: UUID, ids: Collection[UUID] | None = None) -> int:
        """Marca leídos los avisos no leídos del usuario y devuelve cuántos
        eran. Con `ids`, sólo los que la persona tenía en pantalla (CON-10):
        marcar «todo» de la cuenta pisaba avisos que nunca vio. Sin `ids` (un
        cliente viejo, con la app en caché), todos, como antes. Sólo toca los
        suyos: un id ajeno no marca nada."""
        return await self._notifications.mark_all_read(user_id, ids)


# De a cuántas cuentas se le pregunta a identity en el barrido.
_SWEEP_BATCH = 500


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

    async def release(self, *, endpoint: str, auth_key: str, user_id: UUID) -> bool:
        """Baja del dispositivo SIN sesión (`POST /push/release`): la manda el
        navegador al cerrar sesión o cuando la sesión terminó sola, también
        con el token ya vencido o después de un corte de red.

        Borra la suscripción sólo si coinciden las tres cosas: el `endpoint`,
        la clave `auth` de esa suscripción (la prueba: sólo la conocen ese
        navegador y el servidor) y que la fila siga siendo de `user_id`. Lo
        último hace que el orden de llegada no importe: una baja vieja de la
        cuenta que salió no borra el registro de otra que ya entró en ese
        dispositivo. Devuelve si borró; la ruta no lo revela."""
        subscription = await self._subscriptions.get_by_endpoint(endpoint)
        if subscription is None or not subscription.is_released_by(
            user_id=user_id, auth_key=auth_key
        ):
            return False
        # Con `user_id` en el filtro: si entre la lectura y el borrado otra
        # cuenta se quedó con el dispositivo, no se le borra.
        await self._subscriptions.remove_by_endpoint(endpoint, user_id=user_id)
        return True

    async def remove_all_for_user(self, user_id: UUID) -> int:
        """Borra todos los dispositivos de una cuenta (al suspenderla,
        ADR-0024). Devuelve cuántos eran. Nada los restaura: cada dispositivo
        se vuelve a registrar solo en el próximo ingreso."""
        return await self._subscriptions.remove_all_for_users([user_id])

    async def remove_devices_of_revoked_accounts(self, sessions: SessionRevocations) -> int:
        """Barrido: borra los dispositivos de las cuentas que se quedaron sin
        sesión por una revocación (cerró sesión en todos lados, contraseña
        restablecida, refresh reutilizado, suspensión). Devuelve cuántos borró.

        NO toca a la cuenta cuya sesión sólo venció por no abrir la app:
        `/privacidad` promete el borrado al desactivar y al cerrar sesión, no
        por inactividad, y a quien hace un mes que no entra el aviso de un
        turno cerca es lo que lo trae de vuelta. Ese dispositivo se da de baja
        cuando se abre la app ahí (`POST /push/release`).

        Es por cuenta, no por dispositivo: si la cuenta sigue con una sesión
        viva en otro lado, no se borra ninguno."""
        user_ids = await self._subscriptions.list_user_ids()
        removed = 0
        for start in range(0, len(user_ids), _SWEEP_BATCH):
            batch = user_ids[start : start + _SWEEP_BATCH]
            revoked = await sessions.ended_by_revocation(batch)
            removed += await self._subscriptions.remove_all_for_users(sorted(revoked))
        return removed
