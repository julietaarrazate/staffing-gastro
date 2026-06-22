"""Modelo ORM de los mensajes de chat (tabla `chat_messages`)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    shift_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
