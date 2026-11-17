"""Entidades del dominio de notificaciones."""

import hmac
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.notification.domain.value_objects import NotificationType


# Topes de las columnas `title` (255) y `message` (500) de `notifications`.
# Viven acá, en un solo lugar: un nombre o título largo (de comercio, de turno,
# de quien escribe en el chat) no debe romper el aviso DESPUÉS de que la
# acción de fondo ya se guardó.
TITLE_MAX = 255
MESSAGE_MAX = 500


def clip_text(text: str, limit: int) -> str:
    """Recorta a `limit` caracteres, con «…» al final si hubo que cortar.
    Un valor ausente (None) pasa tal cual: lo rechaza la base, no se disfraza."""
    return text if text is None or len(text) <= limit else text[: limit - 1].rstrip() + "…"


@dataclass
class Notification:
    """Raíz de agregado Notificación: un aviso in-app para un usuario."""

    user_id: UUID
    type: NotificationType
    title: str
    message: str

    read: bool = False
    # Destino concreto del aviso (`/shifts/<id>/candidates`, `/turno/<id>`).
    # Sin él se cae al destino genérico por tipo (ver `deep_link_for`), que
    # sólo puede llevar a la pantalla de lista.
    link: str | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        self.title = clip_text(self.title, TITLE_MAX)
        self.message = clip_text(self.message, MESSAGE_MAX)


def _same_key(one: str, other: str) -> bool:
    # En tiempo constante: `auth` es un secreto compartido con el navegador.
    return hmac.compare_digest(one.encode(), other.encode())


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

    def is_same_browser_as(self, other: "PushSubscription") -> bool:
        """¿Las dos salieron del mismo navegador? Las claves son de la
        suscripción, no de la sesión: un navegador manda siempre las mismas
        para su `endpoint`, entre quien entre. Por eso sólo quien las presenta
        puede quedarse con una suscripción que ya existe; conocer el
        `endpoint` de otra persona no alcanza."""
        same_p256dh = _same_key(self.p256dh_key, other.p256dh_key)
        same_auth = _same_key(self.auth_key, other.auth_key)
        return self.endpoint == other.endpoint and same_p256dh and same_auth
