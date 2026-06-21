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
