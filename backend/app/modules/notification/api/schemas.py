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
