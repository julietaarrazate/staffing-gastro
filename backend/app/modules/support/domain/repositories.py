"""Puertos de los repositorios de soporte."""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.support.domain.entities import (
    CompanyFacts,
    EnrichedTicket,
    ShiftFacts,
    SupportMessage,
    SupportTicket,
    TicketOpener,
)
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

    @abstractmethod
    async def get_opener(self, ticket_id: UUID) -> TicketOpener | None:
        """Nombre y rol de quien abrió el ticket (uso admin)."""


class SupportMessageRepository(ABC):
    """Puerto de persistencia para Mensaje de soporte."""

    @abstractmethod
    async def add(self, message: SupportMessage) -> SupportMessage:
        """Persiste un nuevo mensaje y lo devuelve."""

    @abstractmethod
    async def list_by_ticket(self, ticket_id: UUID) -> list[SupportMessage]:
        """Lista los mensajes de un ticket (más antiguos primero)."""


class ReferenceLookup(ABC):
    """Puerto hacia los módulos shift, application, company y worker: sólo
    hechos, sin reglas. Quién puede atar qué a un ticket lo decide el caso de
    uso (`SupportService`), no el adaptador."""

    @abstractmethod
    async def get_shift_facts(self, shift_id: UUID) -> ShiftFacts | None:
        """Datos del turno, o None si no existe."""

    @abstractmethod
    async def get_company_facts(self, company_id: UUID) -> CompanyFacts | None:
        """Datos del comercio, o None si no existe."""

    @abstractmethod
    async def worker_profile_id_of(self, user_id: UUID) -> UUID | None:
        """Perfil de trabajador de esta cuenta, si lo tiene."""

    @abstractmethod
    async def worker_applied_to(self, shift_id: UUID, worker_profile_id: UUID) -> bool:
        """¿Se postuló alguna vez a este turno (cualquier estado de la postulación)?"""
