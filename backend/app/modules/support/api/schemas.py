"""Esquemas HTTP (Pydantic) del módulo support."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.support.domain.value_objects import TicketCategory, TicketStatus


class CreateTicketRequest(BaseModel):
    category: TicketCategory
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    sender_user_id: UUID
    body: str
    created_at: datetime | None = None


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    category: TicketCategory
    subject: str
    status: TicketStatus
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TicketDetailResponse(TicketResponse):
    messages: list[MessageResponse]


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
