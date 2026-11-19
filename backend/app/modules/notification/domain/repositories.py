"""Puertos de los repositorios del módulo notification."""

from abc import ABC, abstractmethod
from collections.abc import Collection
from datetime import datetime
from uuid import UUID

from app.modules.notification.domain.entities import Notification, PushSubscription


class NotificationRepository(ABC):
    """Puerto de persistencia para Notificación."""

    @abstractmethod
    async def add(self, notification: Notification) -> Notification:
        """Persiste una nueva notificación y la devuelve."""

    @abstractmethod
    async def add_many(self, notifications: list[Notification]) -> list[Notification]:
        """Persiste varias notificaciones de una vez (un solo commit) y las
        devuelve. Para los avisos masivos, como el de un turno nuevo a los
        trabajadores de la zona."""

    @abstractmethod
    async def request_live_refresh(self, user_id: UUID) -> None:
        """Le pide a las pantallas abiertas del usuario que se pongan al día
        (`lib/live-refresh.ts`), SIN dejar un aviso: no se guarda, no suma a la
        campanita ni sale push. Sólo llega a quien tiene la app abierta;
        el resto se pone al día al entrar o al volver a la pestaña."""

    @abstractmethod
    async def list_by_user(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Notification]:
        """Lista las notificaciones de un usuario (más recientes primero, paginado)."""

    @abstractmethod
    async def mark_read(self, notification_id: UUID, user_id: UUID) -> Notification | None:
        """Marca como leída una notificación propia del usuario.

        Devuelve None si no existe o no pertenece al usuario (no-disclosure).
        """

    @abstractmethod
    async def mark_all_read(
        self, user_id: UUID, ids: Collection[UUID] | None = None
    ) -> int:
        """Marca como leídas, en una sola operación, las notificaciones no
        leídas del usuario y devuelve cuántas marcó (0 si no había).

        Con `ids`, sólo las de esa lista (lo que la persona tenía en pantalla):
        un aviso que llegó después, o que no entró en la lista que se cargó,
        no se toca. Los ids ajenos o inexistentes se ignoran. Sin `ids`
        (`None`), todas las del usuario (cliente viejo)."""

    @abstractmethod
    async def delete_read_before(self, cutoff: datetime) -> int:
        """Borra las notificaciones YA LEÍDAS creadas antes de `cutoff` y
        devuelve cuántas borró (retención). Las no leídas nunca se borran."""


class PushSubscriptionRepository(ABC):
    """Puerto de persistencia para suscripciones Web Push."""

    @abstractmethod
    async def add(self, subscription: PushSubscription) -> PushSubscription:
        """Persiste la suscripción y la devuelve. Un `endpoint`, una fila.

        Si ya existe una con ese endpoint no se duplica. Cuando la que llega
        es del mismo navegador (`PushSubscription.is_same_browser_as`: mismas
        claves) queda a nombre de `subscription.user_id`: para la misma cuenta
        es idempotente; si era de otra, se reasigna. Cuando las claves no
        coinciden no se toca nada y se devuelve la que ya estaba (ver
        `PushService.subscribe`)."""

    @abstractmethod
    async def remove_by_endpoint(self, endpoint: str, *, user_id: UUID) -> None:
        """Elimina la suscripción de ese endpoint SI es de `user_id` (no-op si
        no existe o es de otra persona)."""

    @abstractmethod
    async def get_by_endpoint(self, endpoint: str) -> PushSubscription | None:
        """La suscripción de ese endpoint (hay una sola), o `None`."""

    @abstractmethod
    async def remove_all_for_users(self, user_ids: list[UUID]) -> int:
        """Elimina todas las suscripciones de esas cuentas (todos sus
        dispositivos) y devuelve cuántas eran."""

    @abstractmethod
    async def list_user_ids(self) -> list[UUID]:
        """Las cuentas que tienen al menos un dispositivo registrado."""

    @abstractmethod
    async def list_by_user(self, user_id: UUID) -> list[PushSubscription]:
        """Lista las suscripciones activas de un usuario (todos sus dispositivos)."""

    @abstractmethod
    async def list_by_users(self, user_ids: list[UUID]) -> list[PushSubscription]:
        """Suscripciones de varios usuarios en una sola consulta."""

    @abstractmethod
    async def remove_many_by_id(self, subscription_ids: list[UUID]) -> None:
        """Elimina en lote suscripciones "muertas" (endpoint dado de baja por
        el navegador/proveedor push, HTTP 404/410) detectadas al enviar."""
