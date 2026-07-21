"""Entidades del dominio de notificaciones."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.notification.domain.value_objects import NotificationType


@dataclass
class Notification:
    """Raíz de agregado Notificación: un aviso in-app para un usuario."""

    user_id: UUID
    type: NotificationType
    title: str
    message: str

    read: bool = False

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None


@dataclass
class PushSubscription:
    """Suscripción Web Push de un dispositivo/navegador de un usuario.

    Mapea 1:1 el objeto `PushSubscription` que entrega la Push API del
    browser (`endpoint` + claves `p256dh`/`auth` para cifrar el payload,
    RFC 8291). Un mismo usuario puede tener varias (un dispositivo por
    suscripción); un mismo `endpoint` identifica un único dispositivo/browser
    (ver índice único en `infrastructure/models.py`)."""

    user_id: UUID
    endpoint: str
    p256dh_key: str
    auth_key: str

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
