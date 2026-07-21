"""Puertos de los repositorios del módulo notification."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.notification.domain.entities import Notification, PushSubscription


class NotificationRepository(ABC):
    """Puerto de persistencia para Notificación."""

    @abstractmethod
    async def add(self, notification: Notification) -> Notification:
        """Persiste una nueva notificación y la devuelve."""

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


class PushSubscriptionRepository(ABC):
    """Puerto de persistencia para suscripciones Web Push."""

    @abstractmethod
    async def add(self, subscription: PushSubscription) -> PushSubscription:
        """Persiste una suscripción nueva y la devuelve.

        Idempotente por `endpoint` (ver `PushService.subscribe`): si ya existe
        una suscripción con ese endpoint, la implementación la devuelve tal
        cual en vez de duplicarla."""

    @abstractmethod
    async def remove_by_endpoint(self, endpoint: str) -> None:
        """Elimina la suscripción de ese endpoint (no-op si no existe)."""

    @abstractmethod
    async def list_by_user(self, user_id: UUID) -> list[PushSubscription]:
        """Lista las suscripciones activas de un usuario (todos sus dispositivos)."""

    @abstractmethod
    async def remove_many_by_id(self, subscription_ids: list[UUID]) -> None:
        """Elimina en lote suscripciones "muertas" (endpoint dado de baja por
        el navegador/proveedor push, HTTP 404/410) detectadas al enviar."""
