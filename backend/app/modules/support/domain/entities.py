"""Entidades del dominio de soporte (usuario ↔ Oído).

Distinto del chat comercio↔trabajador (`chat_messages`, 1:1 por turno) y de
moderación/denuncias (no construido, sin señal real de abuso todavía) — ver
la separación conceptual en la auditoría de producto 2026-08-10, C.1.
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.support.domain.exceptions import TicketClosedError
from app.modules.support.domain.value_objects import TicketCategory, TicketStatus


@dataclass
class SupportTicket:
    """Un problema puntual de un usuario, con Oído como la otra parte."""

    user_id: UUID
    category: TicketCategory
    subject: str
    status: TicketStatus = TicketStatus.ABIERTO

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def close(self) -> None:
        if self.status == TicketStatus.CERRADO:
            raise TicketClosedError(str(self.id))
        self.status = TicketStatus.CERRADO


@dataclass
class SupportMessage:
    """Un mensaje dentro de un ticket (del usuario o de un admin)."""

    ticket_id: UUID
    sender_user_id: UUID
    body: str

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None


@dataclass(frozen=True)
class EnrichedTicket:
    """Ticket + datos del usuario + resumen de mensajes, para el inbox del
    admin (un único JOIN, mismo criterio que `EnrichedApplicant`/
    `EnrichedFavorite`: sin N+1 al listar)."""

    id: UUID
    user_id: UUID
    user_full_name: str
    user_email: str
    user_role: str
    category: TicketCategory
    subject: str
    status: TicketStatus
    message_count: int
    last_message_at: datetime | None
    created_at: datetime | None
