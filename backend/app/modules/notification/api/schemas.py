"""Esquemas HTTP (Pydantic) del módulo de notificaciones."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.notification.domain.value_objects import (
    NotificationType,
    is_known_push_endpoint,
)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: NotificationType
    title: str
    message: str
    read: bool
    link: str | None = None
    created_at: datetime


class MarkAllReadResponse(BaseModel):
    """Cuántos avisos pasaron de no leídos a leídos (0 si no había)."""

    marked: int


# Los endpoints reales (FCM, Apple, Mozilla, Windows) miden unos cientos de
# caracteres. Sin tope, `POST /push/release` (sin sesión) llevaba a la base un
# string de decenas de MB (revisión independiente de la baja del dispositivo).
ENDPOINT_MAX_LENGTH = 2048


def _require_known_push_service(endpoint: str) -> str:
    if not is_known_push_endpoint(endpoint):
        raise ValueError("El endpoint no es de un servicio push conocido")
    return endpoint


class PushSubscriptionKeys(BaseModel):
    """Mismo shape que `PushSubscriptionJSON.keys` del browser (Push API)."""

    p256dh: str = Field(max_length=512)
    auth: str = Field(max_length=512)


class PushSubscribeRequest(BaseModel):
    """Mismo shape que `PushSubscription.toJSON()` del browser: se manda tal
    cual, sin que el frontend tenga que remapear campos."""

    endpoint: str = Field(max_length=ENDPOINT_MAX_LENGTH)
    keys: PushSubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def _known_push_service(cls, value: str) -> str:
        return _require_known_push_service(value)


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(max_length=ENDPOINT_MAX_LENGTH)


class PushReleaseRequest(BaseModel):
    """Baja del dispositivo sin sesión (`POST /push/release`). `auth` es la
    clave de la suscripción (`PushSubscription.toJSON().keys.auth`): la
    prueba de que la manda ese navegador. `user_id` es la cuenta que salió."""

    endpoint: str = Field(max_length=ENDPOINT_MAX_LENGTH)
    auth: str = Field(min_length=1, max_length=512)
    user_id: UUID

    @field_validator("endpoint")
    @classmethod
    def _known_push_service(cls, value: str) -> str:
        return _require_known_push_service(value)


class PushPublicKeyResponse(BaseModel):
    """`vapid_public_key=None` = push desactivado en este servidor (sin
    claves VAPID configuradas): el frontend no debe ofrecer el toggle."""

    vapid_public_key: str | None
