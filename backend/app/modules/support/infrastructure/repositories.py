"""Adaptadores SQLAlchemy de los repositorios de soporte.

`list_all_enriched` arma el inbox del admin con un único JOIN a `users` +
dos subconsultas correlacionadas (cantidad de mensajes y fecha del último),
mismo patrón que `favorite/infrastructure/repositories.py` para
`shifts_together`: sin N+1 al listar.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import UserModel
from app.modules.support.domain.entities import EnrichedTicket, SupportMessage, SupportTicket
from app.modules.support.domain.repositories import (
    SupportMessageRepository,
    SupportTicketRepository,
)
from app.modules.support.domain.value_objects import TicketCategory, TicketStatus
from app.modules.support.infrastructure.models import SupportMessageModel, SupportTicketModel


def _to_ticket(model: SupportTicketModel) -> SupportTicket:
    return SupportTicket(
        id=model.id,
        user_id=model.user_id,
        category=TicketCategory(model.category),
        subject=model.subject,
        status=TicketStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _to_message(model: SupportMessageModel) -> SupportMessage:
    return SupportMessage(
        id=model.id,
        ticket_id=model.ticket_id,
        sender_user_id=model.sender_user_id,
        body=model.body,
        created_at=model.created_at,
    )


class SqlAlchemySupportTicketRepository(SupportTicketRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, ticket: SupportTicket) -> SupportTicket:
        model = SupportTicketModel(
            id=ticket.id,
            user_id=ticket.user_id,
            category=ticket.category.value,
            subject=ticket.subject,
            status=ticket.status.value,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_ticket(model)

    async def update(self, ticket: SupportTicket) -> SupportTicket:
        model = await self._session.get(SupportTicketModel, ticket.id)
        if model is None:
            raise ValueError(f"Ticket {ticket.id} no encontrado")
        model.status = ticket.status.value
        await self._session.commit()
        await self._session.refresh(model)
        return _to_ticket(model)

    async def get_by_id(self, ticket_id: UUID) -> SupportTicket | None:
        model = await self._session.get(SupportTicketModel, ticket_id)
        return _to_ticket(model) if model else None

    async def list_by_user(
        self, user_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[SupportTicket]:
        stmt = (
            select(SupportTicketModel)
            .where(SupportTicketModel.user_id == user_id)
            .order_by(SupportTicketModel.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [_to_ticket(m) for m in result.scalars().all()]

    async def list_all_enriched(
        self, *, status: TicketStatus | None = None, limit: int = 50, offset: int = 0
    ) -> list[EnrichedTicket]:
        message_count = (
            select(func.count(SupportMessageModel.id))
            .where(SupportMessageModel.ticket_id == SupportTicketModel.id)
            .correlate(SupportTicketModel)
            .scalar_subquery()
        )
        last_message_at = (
            select(func.max(SupportMessageModel.created_at))
            .where(SupportMessageModel.ticket_id == SupportTicketModel.id)
            .correlate(SupportTicketModel)
            .scalar_subquery()
        )
        stmt = (
            select(
                SupportTicketModel,
                UserModel.full_name,
                UserModel.email,
                UserModel.role,
                message_count.label("message_count"),
                last_message_at.label("last_message_at"),
            )
            .join(UserModel, UserModel.id == SupportTicketModel.user_id)
            .order_by(SupportTicketModel.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if status is not None:
            stmt = stmt.where(SupportTicketModel.status == status.value)
        result = await self._session.execute(stmt)
        return [
            EnrichedTicket(
                id=ticket.id,
                user_id=ticket.user_id,
                user_full_name=full_name,
                user_email=email,
                user_role=role,
                category=TicketCategory(ticket.category),
                subject=ticket.subject,
                status=TicketStatus(ticket.status),
                message_count=msg_count,
                last_message_at=last_msg_at,
                created_at=ticket.created_at,
            )
            for ticket, full_name, email, role, msg_count, last_msg_at in result.all()
        ]


class SqlAlchemySupportMessageRepository(SupportMessageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, message: SupportMessage) -> SupportMessage:
        model = SupportMessageModel(
            id=message.id,
            ticket_id=message.ticket_id,
            sender_user_id=message.sender_user_id,
            body=message.body,
        )
        self._session.add(model)
        # Un mensaje nuevo "toca" el ticket (para que el inbox del admin lo
        # muestre arriba, ordenado por `updated_at`) — mismo criterio que
        # cualquier bandeja de entrada real.
        ticket_model = await self._session.get(SupportTicketModel, message.ticket_id)
        if ticket_model is not None:
            ticket_model.updated_at = func.now()
        await self._session.commit()
        await self._session.refresh(model)
        return _to_message(model)

    async def list_by_ticket(self, ticket_id: UUID) -> list[SupportMessage]:
        stmt = (
            select(SupportMessageModel)
            .where(SupportMessageModel.ticket_id == ticket_id)
            .order_by(SupportMessageModel.created_at.asc())
        )
        result = await self._session.execute(stmt)
        return [_to_message(m) for m in result.scalars().all()]
