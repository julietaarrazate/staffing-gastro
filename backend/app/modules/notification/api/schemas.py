"""Esquemas HTTP (Pydantic) del módulo de notificaciones."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.notification.domain.value_objects import NotificationType


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: NotificationType
    title: str
    message: str
    read: bool
    created_at: datetime


class PushSubscriptionKeys(BaseModel):
    """Mismo shape que `PushSubscriptionJSON.keys` del browser (Push API)."""

    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    """Mismo shape que `PushSubscription.toJSON()` del browser: se manda tal
    cual, sin que el frontend tenga que remapear campos."""

    endpoint: str
    keys: PushSubscriptionKeys


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class PushPublicKeyResponse(BaseModel):
    """`vapid_public_key=None` = push desactivado en este servidor (sin
    claves VAPID configuradas): el frontend no debe ofrecer el toggle."""

    vapid_public_key: str | None
