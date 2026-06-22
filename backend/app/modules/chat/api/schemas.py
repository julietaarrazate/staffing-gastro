"""Esquemas HTTP (Pydantic) del módulo chat."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shift_id: UUID
    sender_user_id: UUID
    body: str
    read: bool
    created_at: datetime


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shift_id: UUID
    shift_title: str
    other_party_name: str
    other_party_photo: str | None
    last_message: str
    last_message_at: datetime
    unread_count: int
