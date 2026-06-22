"""DTOs de la capa de aplicación del módulo chat."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class ConversationSummary:
    """Resumen de una conversación para el inbox tipo Rappi.

    Reúne datos del turno y del otro participante (su nombre y foto) junto al
    último mensaje y la cantidad de no leídos, para pintar cada tarjeta sin
    que el frontend tenga que cruzar módulos.
    """

    shift_id: UUID
    shift_title: str
    other_party_name: str
    other_party_photo: str | None
    last_message: str
    last_message_at: datetime
    unread_count: int
