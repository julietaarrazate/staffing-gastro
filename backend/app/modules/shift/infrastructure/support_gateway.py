"""Adaptador del puerto `PaymentReportOpener`: abre el ticket de soporte.

Vive en `infrastructure/` porque cruza al módulo `support` (usa su caso de uso,
`SupportService`, con sus mismos chequeos de quién puede atar qué turno)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.domain.repositories import PaymentReportOpener
from app.modules.support.application.services import SupportService
from app.modules.support.domain.value_objects import TicketCategory
from app.modules.support.infrastructure.repositories import (
    SqlAlchemyReferenceLookup,
    SqlAlchemySupportMessageRepository,
    SqlAlchemySupportTicketRepository,
)


class SupportPaymentReportOpener(PaymentReportOpener):
    def __init__(self, session: AsyncSession) -> None:
        self._support = SupportService(
            tickets=SqlAlchemySupportTicketRepository(session),
            messages=SqlAlchemySupportMessageRepository(session),
            notifications=SqlAlchemyNotificationRepository(session),
            references=SqlAlchemyReferenceLookup(session),
        )

    async def open_unpaid_ticket(
        self, *, worker_user_id: UUID, shift_id: UUID, subject: str, body: str
    ) -> UUID:
        ticket, _ = await self._support.create_ticket(
            worker_user_id, TicketCategory.PAGOS, subject, body, shift_id=shift_id
        )
        return ticket.id
