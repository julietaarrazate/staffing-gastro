"""Entidades del dominio de chat."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class ChatMessage:
    """Un mensaje dentro de la conversación de un turno.

    La conversación no es una entidad propia: se identifica por el `shift_id`
    y sus dos participantes (el comercio y el trabajador asignado) se derivan
    del turno. Cada mensaje guarda quién lo envió y si ya fue leído.
    """

    shift_id: UUID
    sender_user_id: UUID
    body: str

    read: bool = False

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
