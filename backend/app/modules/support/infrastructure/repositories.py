"""Adaptadores SQLAlchemy de los repositorios de soporte.

`list_all_enriched` arma el inbox del admin con un único JOIN a `users` +
dos subconsultas correlacionadas (cantidad de mensajes y fecha del último),
mismo patrón que `favorite/infrastructure/repositories.py` para
`shifts_together`: sin N+1 al listar.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.application.infrastructure.models import ShiftApplicationModel
from app.modules.company.infrastructure.models import CompanyProfileModel
from app.modules.identity.domain.value_objects import UserStatus
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.domain.entities import REOFFER_MIN_REMAINING
from app.modules.shift.domain.value_objects import OPEN_STATUSES
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.support.domain.entities import (
    CompanyFacts,
    EnrichedTicket,
    ShiftFacts,
    SupportMessage,
    SupportTicket,
    TicketOpener,
    ResolvedCase,
)
from app.modules.support.domain.repositories import (
    ReferenceLookup,
    SupportMessageRepository,
    SupportTicketRepository,
)
from app.modules.support.domain.value_objects import TicketCategory, TicketStatus
from app.modules.support.infrastructure.models import SupportMessageModel, SupportTicketModel
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _to_ticket(model: SupportTicketModel) -> SupportTicket:
    return SupportTicket(
        id=model.id,
        user_id=model.user_id,
        category=TicketCategory(model.category),
        subject=model.subject,
        status=TicketStatus(model.status),
        shift_id=model.shift_id,
        company_id=model.company_id,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def shift_title_text(title: str | None, position: str | None) -> str | None:
    """El título del turno, o su puesto si el comercio no le puso título."""
    if title and title.strip():
        return title.strip()
    return position.capitalize() if position else None


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
            shift_id=ticket.shift_id,
            company_id=ticket.company_id,
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

    async def get_opener(self, ticket_id: UUID) -> TicketOpener | None:
        row = (
            await self._session.execute(
                select(UserModel.id, UserModel.full_name, UserModel.role)
                .join(SupportTicketModel, SupportTicketModel.user_id == UserModel.id)
                .where(SupportTicketModel.id == ticket_id)
            )
        ).first()
        if row is None:
            return None
        return TicketOpener(user_id=row[0], full_name=row[1], role=row[2])

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
                ShiftModel.title,
                ShiftModel.position,
                ShiftModel.start_at,
                CompanyProfileModel.name,
            )
            .join(UserModel, UserModel.id == SupportTicketModel.user_id)
            .outerjoin(ShiftModel, ShiftModel.id == SupportTicketModel.shift_id)
            .outerjoin(CompanyProfileModel, CompanyProfileModel.id == SupportTicketModel.company_id)
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
                shift_id=ticket.shift_id,
                shift_title=shift_title_text(shift_title, shift_position),
                shift_start_at=shift_start_at,
                company_id=ticket.company_id,
                company_name=company_name,
            )
            for (
                ticket,
                full_name,
                email,
                role,
                msg_count,
                last_msg_at,
                shift_title,
                shift_position,
                shift_start_at,
                company_name,
            ) in result.all()
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


    async def list_resolved_cases(
        self, category: TicketCategory, *, exclude_ticket_id: UUID, limit: int
    ) -> list[ResolvedCase]:
        tickets = (
            await self._session.execute(
                select(SupportTicketModel)
                .where(
                    SupportTicketModel.category == category.value,
                    SupportTicketModel.status == TicketStatus.CERRADO.value,
                    SupportTicketModel.id != exclude_ticket_id,
                )
                .order_by(SupportTicketModel.updated_at.desc())
                # Margen: no todo ticket cerrado tiene respuesta del equipo.
                .limit(limit * 3)
            )
        ).scalars().all()
        if not tickets:
            return []
        mensajes = (
            await self._session.execute(
                select(SupportMessageModel)
                .where(SupportMessageModel.ticket_id.in_([t.id for t in tickets]))
                .order_by(SupportMessageModel.created_at.asc())
            )
        ).scalars().all()
        casos: list[ResolvedCase] = []
        for ticket in tickets:
            del_ticket = [m for m in mensajes if m.ticket_id == ticket.id]
            de_la_persona = [m for m in del_ticket if m.sender_user_id == ticket.user_id]
            del_equipo = [m for m in del_ticket if m.sender_user_id != ticket.user_id]
            if not de_la_persona or not del_equipo:
                continue
            casos.append(
                ResolvedCase(
                    subject=ticket.subject,
                    question=de_la_persona[0].body,
                    reply=del_equipo[-1].body,
                )
            )
            if len(casos) == limit:
                break
        return casos


class SqlAlchemyReferenceLookup(ReferenceLookup):
    """Hechos de shift, application, company y worker para atar un ticket.

    Sólo lee; la regla de quién puede atar qué vive en `SupportService`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_shift_facts(self, shift_id: UUID) -> ShiftFacts | None:
        row = (
            await self._session.execute(
                select(ShiftModel, CompanyProfileModel, UserModel.status)
                .join(CompanyProfileModel, CompanyProfileModel.id == ShiftModel.company_id)
                .join(UserModel, UserModel.id == CompanyProfileModel.user_id)
                .where(ShiftModel.id == shift_id)
            )
        ).first()
        if row is None:
            return None
        shift, company, owner_status = row
        start_at = shift.start_at
        now = datetime.now(timezone.utc)
        # SQLite (tests) devuelve fechas sin zona: se comparan como UTC.
        start_utc = start_at if start_at.tzinfo else start_at.replace(tzinfo=timezone.utc)
        end_at = shift.end_at
        end_utc = end_at if end_at.tzinfo else end_at.replace(tzinfo=timezone.utc)
        # Misma regla que `Shift.is_open_for_applications`: todavía no empezó,
        # o es un turno reofrecido (U080) al que le quedan al menos
        # `REOFFER_MIN_REMAINING` de horario.
        still_offered = start_utc > now or (
            shift.reoffered_at is not None and end_utc - REOFFER_MIN_REMAINING > now
        )
        return ShiftFacts(
            id=shift.id,
            title=shift_title_text(shift.title, shift.position) or "Turno",
            start_at=start_at,
            company_id=company.id,
            company_name=company.name,
            company_user_id=company.user_id,
            worker_profile_id=shift.worker_profile_id,
            publicly_open=(
                shift.status in {s.value for s in OPEN_STATUSES}
                and still_offered
                and owner_status == UserStatus.ACTIVE.value
            ),
        )

    async def get_company_facts(self, company_id: UUID) -> CompanyFacts | None:
        row = (
            await self._session.execute(
                select(CompanyProfileModel, UserModel.status)
                .join(UserModel, UserModel.id == CompanyProfileModel.user_id)
                .where(CompanyProfileModel.id == company_id)
            )
        ).first()
        if row is None:
            return None
        company, owner_status = row
        return CompanyFacts(
            id=company.id,
            user_id=company.user_id,
            name=company.name,
            account_active=owner_status == UserStatus.ACTIVE.value,
        )

    async def worker_profile_id_of(self, user_id: UUID) -> UUID | None:
        return (
            await self._session.execute(
                select(WorkerProfileModel.id).where(WorkerProfileModel.user_id == user_id)
            )
        ).scalar_one_or_none()

    async def worker_applied_to(self, shift_id: UUID, worker_profile_id: UUID) -> bool:
        found = (
            await self._session.execute(
                select(ShiftApplicationModel.id).where(
                    ShiftApplicationModel.shift_id == shift_id,
                    ShiftApplicationModel.worker_profile_id == worker_profile_id,
                )
            )
        ).first()
        return found is not None
