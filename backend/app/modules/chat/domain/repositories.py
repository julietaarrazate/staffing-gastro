"""Puerto del repositorio de mensajes de chat."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.chat.domain.entities import ChatMessage, InboxCandidate, Thread


class ChatMessageRepository(ABC):
    """Puerto de persistencia para los mensajes de chat.

    Toda lectura es por hilo (`Thread`: turno + persona asignada), nunca por
    turno a secas: un turno reasignado tiene un hilo por cada persona que lo
    tuvo, y cada uno lo ven sólo el comercio y esa persona.
    """

    @abstractmethod
    async def add(self, message: ChatMessage) -> ChatMessage:
        """Persiste un nuevo mensaje y lo devuelve."""

    @abstractmethod
    async def list_by_thread(self, thread: Thread) -> list[ChatMessage]:
        """Lista los mensajes de un hilo en orden cronológico ascendente."""

    @abstractmethod
    async def mark_read(self, thread: Thread, reader_user_id: UUID) -> bool:
        """Marca como leídos los mensajes que el usuario recibió en ese hilo.

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
    async def last_messages(self, threads: list[Thread]) -> dict[Thread, ChatMessage]:
        """Último mensaje de cada hilo en `threads`, en una sola consulta."""

    @abstractmethod
    async def unread_counts(
        self, threads: list[Thread], recipient_user_id: UUID
    ) -> dict[Thread, int]:
        """No leídos por hilo para el usuario receptor, en una sola consulta."""
