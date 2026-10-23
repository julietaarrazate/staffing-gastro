"""Modelo ORM de los mensajes de chat (tabla `chat_messages`)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
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
        # Sin índice simple: lo cubre `(shift_id, created_at)` (0041).
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    # Con índice: casi todo termina leído, así que `read = false` es selectivo
    # y el planner lo usa para contar y marcar los no leídos (ver 0041).
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# Mensajes de un chat en orden y último mensaje por chat (ROW_NUMBER
# particionado por shift_id, ordenado por created_at): 0040.
Index(
    "ix_chat_messages_shift_id_created_at",
    ChatMessageModel.shift_id,
    ChatMessageModel.created_at,
)
