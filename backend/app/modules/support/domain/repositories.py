"""Puertos de los repositorios de soporte."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.support.domain.entities import EnrichedTicket, SupportMessage, SupportTicket
from app.modules.support.domain.value_objects import TicketStatus


class SupportTicketRepository(ABC):
    """Puerto de persistencia para Ticket de soporte."""

    @abstractmethod
    async def add(self, ticket: SupportTicket) -> SupportTicket:
        """Persiste un nuevo ticket y lo devuelve."""

    @abstractmethod
    async def update(self, ticket: SupportTicket) -> SupportTicket:
        """Actualiza un ticket existente y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, ticket_id: UUID) -> SupportTicket | None:
        """Busca un ticket por su id."""

    @abstractmethod
    async def list_by_user(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[SupportTicket]:
        """Lista los tickets propios de un usuario (más recientes primero, paginado)."""

    @abstractmethod
    async def list_all_enriched(
        self, *, status: TicketStatus | None = None, limit: int = 50, offset: int = 0
    ) -> list[EnrichedTicket]:
        """Lista TODOS los tickets (uso admin), enriquecidos con datos del
        usuario y resumen de mensajes, más recientes primero, paginado."""


class SupportMessageRepository(ABC):
    """Puerto de persistencia para Mensaje de soporte."""

    @abstractmethod
    async def add(self, message: SupportMessage) -> SupportMessage:
        """Persiste un nuevo mensaje y lo devuelve."""

    @abstractmethod
    async def list_by_ticket(self, ticket_id: UUID) -> list[SupportMessage]:
        """Lista los mensajes de un ticket (más antiguos primero)."""
