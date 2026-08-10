"""Modelos ORM de soporte (tablas `support_tickets`/`support_messages`)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID
from app.modules.support.domain.value_objects import TicketStatus


class SupportTicketModel(Base):
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TicketStatus.ABIERTO.value, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SupportMessageModel(Base):
    __tablename__ = "support_messages"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
