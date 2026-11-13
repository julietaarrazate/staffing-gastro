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
    # La persona del hilo (0045): el trabajador con quien el comercio estaba
    # hablando cuando se escribió el mensaje. Junto con `shift_id` identifica
    # la conversación: un turno reasignado tiene un hilo por cada persona que
    # lo tuvo. NULL sólo en mensajes anteriores a la 0045 cuyo destinatario no
    # se pudo deducir: quedan guardados, pero ninguna consulta los devuelve.
    worker_user_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        # Sin índice simple: lo cubre el compuesto de abajo (0045).
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

# Mensajes de un hilo en orden, último mensaje y no leídos por hilo: todas las
# lecturas del chat filtran por (turno, persona del hilo). Con `worker_user_id`
# adelante también sirve a la clave foránea a `users` (0045).
Index(
    "ix_chat_messages_worker_user_id_shift_id_created_at",
    ChatMessageModel.worker_user_id,
    ChatMessageModel.shift_id,
    ChatMessageModel.created_at,
)
