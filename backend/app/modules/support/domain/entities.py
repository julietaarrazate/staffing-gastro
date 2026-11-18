"""Entidades del dominio de soporte (usuario ↔ Oído).

Distinto del chat comercio↔trabajador (`chat_messages`, 1:1 por turno) y de
moderación/denuncias (no construido, sin señal real de abuso todavía) — ver
la separación conceptual en la auditoría de producto 2026-08-10, C.1.
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.support.domain.exceptions import TicketClosedError, TicketNotClosedError
from app.modules.support.domain.value_objects import TicketCategory, TicketStatus


@dataclass
class SupportTicket:
    """Un problema puntual de un usuario, con Oído como la otra parte."""

    user_id: UUID
    category: TicketCategory
    subject: str
    status: TicketStatus = TicketStatus.ABIERTO
    # U110: referencia opcional a un turno y/o un comercio (ya validada por el
    # caso de uso: sólo lo que la persona puede ver).
    shift_id: UUID | None = None
    company_id: UUID | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def close(self) -> None:
        if self.status == TicketStatus.CERRADO:
            raise TicketClosedError(str(self.id))
        self.status = TicketStatus.CERRADO

    def reopen(self) -> None:
        """Sólo lo dispara un admin (decisión 12): la persona no reabre sola."""
        if self.status != TicketStatus.CERRADO:
            raise TicketNotClosedError(str(self.id))
        self.status = TicketStatus.ABIERTO


@dataclass(frozen=True)
class TicketOpener:
    """Quién abrió un ticket (nombre y rol), para el detalle del admin."""

    user_id: UUID
    full_name: str
    role: str


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
    shift_id: UUID | None = None
    shift_title: str | None = None
    shift_start_at: datetime | None = None
    company_id: UUID | None = None
    company_name: str | None = None


@dataclass(frozen=True)
class ShiftFacts:
    """Lo que el caso de uso necesita saber de un turno para decidir si una
    persona puede atarlo a un ticket (lo arma el puerto `ReferenceLookup`)."""

    id: UUID
    title: str
    start_at: datetime
    company_id: UUID
    company_name: str | None
    company_user_id: UUID
    worker_profile_id: UUID | None
    # Abierto a postulaciones (publicado o buscando personal, con la hora de
    # inicio por delante) y con la cuenta del comercio activa: el turno que
    # cualquiera ve en el Inicio.
    publicly_open: bool


@dataclass(frozen=True)
class CompanyFacts:
    """Lo que el caso de uso necesita saber de un comercio."""

    id: UUID
    user_id: UUID
    name: str
    account_active: bool


@dataclass(frozen=True)
class ShiftRef:
    """El turno al que está atado un ticket, para mostrarlo."""

    id: UUID
    title: str
    start_at: datetime
    company_name: str | None = None


@dataclass(frozen=True)
class CompanyRef:
    """El comercio al que está atado un ticket, para mostrarlo.
    `user_id` es la cuenta dueña (el admin llega a su ficha por ahí)."""

    id: UUID
    name: str
    user_id: UUID


@dataclass(frozen=True)
class TicketReferences:
    shift: ShiftRef | None = None
    company: CompanyRef | None = None
