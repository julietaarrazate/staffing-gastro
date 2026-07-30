"""Puerto del repositorio de mensajes de chat."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.chat.domain.entities import ChatMessage, InboxCandidate


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
    async def mark_read(self, shift_id: UUID, recipient_user_id: UUID) -> bool:
        """Marca como leídos los mensajes que el usuario recibió en ese turno.

        Devuelve si marcó algo (había mensajes sin leer): con eso el servicio
        decide si vale la pena avisarle a quien los mandó, en vivo, que ya se
        vieron (ver `ChatService.list_messages`)."""

    # --- Inbox agregado (evita el N+1 de `list_conversations`, P1) ---

    @abstractmethod
    async def list_inbox_candidates(self, user_id: UUID) -> list[InboxCandidate]:
        """Turnos con trabajador asignado donde el usuario es comercio o trabajador.

        Una sola consulta (JOIN) con los datos de ambas contrapartes posibles.
        """

    @abstractmethod
    async def last_messages(self, shift_ids: list[UUID]) -> dict[UUID, ChatMessage]:
        """Último mensaje de cada turno en `shift_ids`, en una sola consulta."""

    @abstractmethod
    async def unread_counts_by_shift(
        self, shift_ids: list[UUID], recipient_user_id: UUID
    ) -> dict[UUID, int]:
        """No leídos por turno para el usuario receptor, en una sola consulta."""
