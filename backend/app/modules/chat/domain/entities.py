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


@dataclass(frozen=True)
class InboxCandidate:
    """Fila cruda de un posible ítem del inbox: el turno y sus dos contrapartes.

    Se arma con un único JOIN (turno + comercio + trabajador + usuario del
    trabajador) para poder construir el inbox del chat sin N+1 (ver
    `ChatMessageRepository.list_inbox_candidates` y
    `docs/PERFORMANCE_REPORT.md` P1). El servicio de aplicación decide, según
    el `user_id` que consulta, cuál de las dos contrapartes es "la otra".
    """

    shift_id: UUID
    shift_title: str
    company_user_id: UUID
    company_name: str
    company_logo_url: str | None
    worker_user_id: UUID
    worker_full_name: str
    worker_photo_url: str | None
