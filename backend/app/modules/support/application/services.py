"""Casos de uso del módulo support (tickets de soporte usuario ↔ Oído)."""

from uuid import UUID

from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.support.domain.entities import (
    CompanyFacts,
    CompanyRef,
    EnrichedTicket,
    ShiftFacts,
    ShiftRef,
    SupportMessage,
    SupportTicket,
    TicketOpener,
    TicketReferences,
)
from app.modules.support.domain.exceptions import (
    EmptyMessageError,
    ReferenceNotFoundError,
    TicketClosedError,
    TicketNotFoundError,
)
from app.modules.support.domain.repositories import (
    ReferenceLookup,
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
        references: ReferenceLookup,
    ) -> None:
        self._tickets = tickets
        self._messages = messages
        self._notifications = notifications
        self._references = references

    async def create_ticket(
        self,
        user_id: UUID,
        category: TicketCategory,
        subject: str,
        body: str,
        *,
        shift_id: UUID | None = None,
        company_id: UUID | None = None,
    ) -> tuple[SupportTicket, SupportMessage]:
        if not subject.strip() or not body.strip():
            raise EmptyMessageError(user_id.hex)
        shift_id, company_id = await self._authorize_references(user_id, shift_id, company_id)
        ticket = await self._tickets.add(
            SupportTicket(
                user_id=user_id,
                category=category,
                subject=subject.strip(),
                shift_id=shift_id,
                company_id=company_id,
            )
        )
        message = await self._messages.add(
            SupportMessage(ticket_id=ticket.id, sender_user_id=user_id, body=body.strip())
        )
        return ticket, message

    async def resolve_references(
        self, user_id: UUID, *, shift_id: UUID | None, company_id: UUID | None
    ) -> TicketReferences:
        """Lo que se va a atar al ticket, para que la persona lo confirme
        antes de mandar. Mismas reglas (y mismo error) que `create_ticket`."""
        shift_id, company_id = await self._authorize_references(user_id, shift_id, company_id)
        return await self._describe(shift_id, company_id)

    async def describe_references(self, ticket: SupportTicket) -> TicketReferences:
        """La referencia de un ticket ya creado (sin chequeo: quien lo ve ya
        estaba autorizado a ver el ticket, y la referencia se validó al crearlo)."""
        return await self._describe(ticket.shift_id, ticket.company_id)

    async def add_message(
        self, requester_id: UUID, ticket_id: UUID, body: str, *, is_admin: bool
    ) -> SupportMessage:
        if not body.strip():
            raise EmptyMessageError(ticket_id.hex)
        ticket = await self._authorized_ticket(requester_id, ticket_id, is_admin=is_admin)
        # Un mensaje del admin en un ticket cerrado lo reabre (la persona
        # puede contestar); la persona no lo reabre sola mandando otro mensaje.
        reopened = False
        if ticket.status == TicketStatus.CERRADO:
            if not is_admin:
                raise TicketClosedError(str(ticket.id))
            ticket.reopen()
            await self._tickets.update(ticket)
            reopened = True
        message = await self._messages.add(
            SupportMessage(ticket_id=ticket.id, sender_user_id=requester_id, body=body.strip())
        )
        if is_admin:
            await self._notify_reply(ticket, reopened=reopened)
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

    async def get_opener(self, ticket_id: UUID) -> TicketOpener | None:
        """Sólo admin (la restricción de rol se aplica en la capa API)."""
        return await self._tickets.get_opener(ticket_id)

    async def close_ticket(
        self, requester_id: UUID, ticket_id: UUID, *, is_admin: bool
    ) -> SupportTicket:
        ticket = await self._authorized_ticket(requester_id, ticket_id, is_admin=is_admin)
        ticket.close()
        return await self._tickets.update(ticket)

    async def reopen_ticket(self, ticket_id: UUID) -> SupportTicket:
        """Sólo admin (la restricción de rol se aplica en la capa API).

        Reabrir sin mensaje no avisa a la persona: el aviso sale cuando el
        admin escribe.
        """
        ticket = await self._tickets.get_by_id(ticket_id)
        if ticket is None:
            raise TicketNotFoundError(str(ticket_id))
        ticket.reopen()
        return await self._tickets.update(ticket)

    async def _authorized_ticket(
        self, requester_id: UUID, ticket_id: UUID, *, is_admin: bool
    ) -> SupportTicket:
        ticket = await self._tickets.get_by_id(ticket_id)
        if ticket is None or (not is_admin and ticket.user_id != requester_id):
            raise TicketNotFoundError(str(ticket_id))
        return ticket

    async def _notify_reply(self, ticket: SupportTicket, *, reopened: bool = False) -> None:
        message = f'Hay una respuesta nueva en tu ticket "{ticket.subject}".'
        if reopened:
            message = (
                f'Reabrimos tu ticket "{ticket.subject}" y hay una respuesta nueva. '
                "Podés contestar."
            )
        await self._notifications.add(
            Notification(
                user_id=ticket.user_id,
                type=NotificationType.SUPPORT_REPLY,
                title="Te respondieron en soporte",
                message=message,
                link=f"/support/{ticket.id}",
            )
        )

    async def _describe(
        self, shift_id: UUID | None, company_id: UUID | None
    ) -> TicketReferences:
        shift_ref = None
        company_ref = None
        if shift_id is not None:
            shift = await self._references.get_shift_facts(shift_id)
            if shift is not None:
                shift_ref = ShiftRef(
                    id=shift.id,
                    title=shift.title,
                    start_at=shift.start_at,
                    company_name=shift.company_name,
                )
        if company_id is not None:
            company = await self._references.get_company_facts(company_id)
            if company is not None:
                company_ref = CompanyRef(id=company.id, name=company.name, user_id=company.user_id)
        return TicketReferences(shift=shift_ref, company=company_ref)

    async def _authorize_references(
        self, user_id: UUID, shift_id: UUID | None, company_id: UUID | None
    ) -> tuple[UUID | None, UUID | None]:
        """Reglas de U110 (no-disclosure: inexistente y ajeno dan el mismo error).

        - Turno: lo puede atar el comercio dueño; y un trabajador si fue asignado,
          se postuló, o es un turno abierto que ve en el Inicio.
        - Comercio: su propia cuenta; o cualquier trabajador (el perfil público
          del comercio lo ve cualquier sesión).
        - Con las dos referencias, el comercio tiene que ser el del turno. Con
          sólo el turno, el comercio se completa solo.
        """
        shift: ShiftFacts | None = None
        if shift_id is not None:
            shift = await self._references.get_shift_facts(shift_id)
            if shift is None or not await self._can_reference_shift(user_id, shift):
                raise ReferenceNotFoundError("turno")
            if company_id is not None and company_id != shift.company_id:
                raise ReferenceNotFoundError("comercio")
            company_id = shift.company_id
        elif company_id is not None:
            company = await self._references.get_company_facts(company_id)
            if company is None or not await self._can_reference_company(user_id, company):
                raise ReferenceNotFoundError("comercio")
        return shift_id, company_id

    async def _can_reference_shift(self, user_id: UUID, shift: ShiftFacts) -> bool:
        if shift.company_user_id == user_id:
            return True
        worker_profile_id = await self._references.worker_profile_id_of(user_id)
        if worker_profile_id is None:
            return False
        if shift.worker_profile_id == worker_profile_id or shift.publicly_open:
            return True
        return await self._references.worker_applied_to(shift.id, worker_profile_id)

    async def _can_reference_company(self, user_id: UUID, company: CompanyFacts) -> bool:
        if company.user_id == user_id:
            return True
        # Un trabajador puede reportar cualquier comercio que vería en su perfil
        # público (`GET /companies/{id}` lo muestra a cualquier sesión, sin
        # filtrar por suspensión), así que atarlo no revela nada.
        return await self._references.worker_profile_id_of(user_id) is not None
