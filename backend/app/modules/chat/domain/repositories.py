"""Puerto del repositorio de mensajes de chat."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.chat.domain.entities import ChatMessage


class ChatMessageRepository(ABC):
    """Puerto de persistencia para los mensajes de chat."""

    @abstractmethod
    async def add(self, message: ChatMessage) -> ChatMessage:
        """Persiste un nuevo mensaje y lo devuelve."""

    @abstractmethod
    async def list_by_shift(self, shift_id: UUID) -> list[ChatMessage]:
        """Lista los mensajes de un turno en orden cronológico ascendente."""

    @abstractmethod
    async def last_message(self, shift_id: UUID) -> ChatMessage | None:
        """Devuelve el último mensaje del turno, o None si no hay ninguno."""

    @abstractmethod
    async def count_unread(self, shift_id: UUID, recipient_user_id: UUID) -> int:
        """Cuenta los mensajes no leídos que recibió el usuario en ese turno."""

    @abstractmethod
    async def mark_read(self, shift_id: UUID, recipient_user_id: UUID) -> None:
        """Marca como leídos los mensajes que el usuario recibió en ese turno."""
