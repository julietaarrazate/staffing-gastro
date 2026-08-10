"""Casos de uso del módulo support (tickets de soporte usuario ↔ Oído)."""

from uuid import UUID

from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.support.domain.entities import EnrichedTicket, SupportMessage, SupportTicket
from app.modules.support.domain.exceptions import (
    EmptyMessageError,
    TicketClosedError,
    TicketNotFoundError,
)
from app.modules.support.domain.repositories import (
    SupportMessageRepository,
    SupportTicketRepository,
)
from app.modules.support.domain.value_objects import TicketCategory, TicketStatus


class SupportService:
    """Abrir/responder/cerrar tickets de soporte y listarlos.

    La autorización de "quién puede ver/responder qué" vive acá (no en el
    route): un usuario sólo ve sus propios tickets; un admin ve y responde
    cualquiera. Mismo criterio no-disclosure que el resto de la app: un
    ticket ajeno o inexistente da el mismo error.
    """

    def __init__(
        self,
        tickets: SupportTicketRepository,
        messages: SupportMessageRepository,
        notifications: NotificationRepository,
    ) -> None:
        self._tickets = tickets
        self._messages = messages
        self._notifications = notifications

    async def create_ticket(
        self, user_id: UUID, category: TicketCategory, subject: str, body: str
    ) -> tuple[SupportTicket, SupportMessage]:
        if not subject.strip() or not body.strip():
            raise EmptyMessageError(user_id.hex)
        ticket = await self._tickets.add(
            SupportTicket(user_id=user_id, category=category, subject=subject.strip())
        )
        message = await self._messages.add(
            SupportMessage(ticket_id=ticket.id, sender_user_id=user_id, body=body.strip())
        )
        return ticket, message

    async def add_message(
        self, requester_id: UUID, ticket_id: UUID, body: str, *, is_admin: bool
    ) -> SupportMessage:
        if not body.strip():
            raise EmptyMessageError(ticket_id.hex)
        ticket = await self._authorized_ticket(requester_id, ticket_id, is_admin=is_admin)
        # El admin puede seguir aclarando algo en un ticket cerrado; el
        # usuario no puede "reabrirlo" solo mandando otro mensaje.
        if ticket.status == TicketStatus.CERRADO and not is_admin:
            raise TicketClosedError(str(ticket.id))
        message = await self._messages.add(
            SupportMessage(ticket_id=ticket.id, sender_user_id=requester_id, body=body.strip())
        )
        if is_admin:
            await self._notify_reply(ticket)
        return message

    async def get_ticket(
        self, requester_id: UUID, ticket_id: UUID, *, is_admin: bool
    ) -> tuple[SupportTicket, list[SupportMessage]]:
        ticket = await self._authorized_ticket(requester_id, ticket_id, is_admin=is_admin)
        return ticket, await self._messages.list_by_ticket(ticket.id)

    async def list_my_tickets(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[SupportTicket]:
        return await self._tickets.list_by_user(user_id, limit=limit, offset=offset)

    async def list_all_tickets(
        self, *, status: TicketStatus | None = None, limit: int = 50, offset: int = 0
    ) -> list[EnrichedTicket]:
        """Sólo para admin — la restricción de rol se aplica en la capa API."""
        return await self._tickets.list_all_enriched(status=status, limit=limit, offset=offset)

    async def close_ticket(
        self, requester_id: UUID, ticket_id: UUID, *, is_admin: bool
    ) -> SupportTicket:
        ticket = await self._authorized_ticket(requester_id, ticket_id, is_admin=is_admin)
        ticket.close()
        return await self._tickets.update(ticket)

    async def _authorized_ticket(
        self, requester_id: UUID, ticket_id: UUID, *, is_admin: bool
    ) -> SupportTicket:
        ticket = await self._tickets.get_by_id(ticket_id)
        if ticket is None or (not is_admin and ticket.user_id != requester_id):
            raise TicketNotFoundError(str(ticket_id))
        return ticket

    async def _notify_reply(self, ticket: SupportTicket) -> None:
        await self._notifications.add(
            Notification(
                user_id=ticket.user_id,
                type=NotificationType.SUPPORT_REPLY,
                title="Te respondieron en soporte",
                message=f'Hay una respuesta nueva en tu ticket "{ticket.subject}".',
                link=f"/support/{ticket.id}",
            )
        )
