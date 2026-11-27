"""Esquemas HTTP (Pydantic) del módulo support."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.support.domain.value_objects import TicketCategory, TicketStatus


class CreateTicketRequest(BaseModel):
    category: TicketCategory
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)
    # U110: turno y/o comercio al que se refiere el ticket (opcionales).
    shift_id: UUID | None = None
    company_id: UUID | None = None


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    sender_user_id: UUID
    body: str
    created_at: datetime | None = None


class ShiftRefResponse(BaseModel):
    id: UUID
    title: str
    start_at: datetime
    company_name: str | None = None


class CompanyRefResponse(BaseModel):
    id: UUID
    name: str
    # Cuenta dueña del comercio: sólo se completa para el admin (su ficha).
    user_id: UUID | None = None


class ReferencesResponse(BaseModel):
    shift: ShiftRefResponse | None = None
    company: CompanyRefResponse | None = None


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    category: TicketCategory
    subject: str
    status: TicketStatus
    shift_id: UUID | None = None
    company_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TicketOpenerResponse(BaseModel):
    """Quién abrió el ticket (sólo se completa para el admin)."""

    user_id: UUID
    full_name: str
    role: str


class TicketDetailResponse(TicketResponse):
    messages: list[MessageResponse]
    opened_by: TicketOpenerResponse | None = None
    references: ReferencesResponse | None = None


class TicketSuggestionResponse(BaseModel):
    """Sugerencia interna de IA (P?, ver core/gemini.py) — nunca se le manda
    directo al usuario, sólo precarga el campo de respuesta del admin."""

    summary: str
    suggested_reply: str
    # En cuántos casos ya resueltos se apoyó (la memoria del soporte): se le
    # muestra a quien responde, para que sepa de dónde sale el criterio.
    precedents_used: int = 0


class AdminTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    user_full_name: str
    user_email: str
    user_role: str
    category: TicketCategory
    subject: str
    status: TicketStatus
    message_count: int
    last_message_at: datetime | None = None
    created_at: datetime | None = None
    shift_id: UUID | None = None
    shift_title: str | None = None
    shift_start_at: datetime | None = None
    company_id: UUID | None = None
    company_name: str | None = None
