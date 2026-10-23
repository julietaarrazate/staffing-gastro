"""Modelos ORM del módulo notification (tablas `notifications`,
`push_subscriptions`)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID
from app.modules.notification.domain.value_objects import NotificationType


class NotificationModel(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        # Sin índice simple: lo cubren los dos compuestos de abajo (0040).
    )

    type: Mapped[str] = mapped_column(
        String(30), nullable=False, default=NotificationType.SHIFT_ASSIGNED.value
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    # Sin índice simple (0041): ninguna consulta filtra por `read` solo.
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Pantalla exacta que abre este aviso (p. ej. `/shifts/<id>/candidates`).
    # Nullable: las notificaciones creadas antes de esta columna caen al
    # destino genérico por tipo (`deep_link_for`).
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# Índices compuestos (0022 y 0040). `user_id, created_at DESC` es la forma
# exacta de la bandeja (`list_by_user`: WHERE user_id ORDER BY created_at DESC
# LIMIT); `user_id, read` es el conteo de no leídas.
Index("ix_notifications_user_id_read", NotificationModel.user_id, NotificationModel.read)
Index(
    "ix_notifications_user_id_created_at",
    NotificationModel.user_id,
    NotificationModel.created_at.desc(),
)


class PushSubscriptionModel(Base):
    """Tabla `push_subscriptions`: suscripciones Web Push por dispositivo/
    navegador de un usuario (ver `domain/entities.py::PushSubscription`)."""

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    p256dh_key: Mapped[str] = mapped_column(Text, nullable=False)
    auth_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
