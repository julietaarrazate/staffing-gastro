"""Adaptador SQLAlchemy del ChatMessageRepository.

Además de la mensajería 1-1 (`chat_messages`), este repo resuelve el inbox
agregado (`list_inbox_candidates` + `last_messages` + `unread_counts_by_shift`)
con JOINs a `shifts`/`company_profiles`/`worker_profiles`/`users` en vez de
una consulta por conversación (fix de P1 en `docs/audits/PERFORMANCE_REPORT.md`).
Importar modelos de otros módulos en infraestructura para armar estos JOINs
de lectura ya es un patrón establecido en el repo (ver
`matching/infrastructure/repositories.py`).
"""

from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.modules.chat.domain.entities import ChatMessage, InboxCandidate
from app.modules.chat.domain.repositories import ChatMessageRepository
from app.modules.chat.infrastructure.models import ChatMessageModel
from app.modules.company.infrastructure.models import CompanyProfileModel
from app.modules.identity.infrastructure.models import UserModel
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.infrastructure.models import WorkerProfileModel


def _to_entity(model: ChatMessageModel) -> ChatMessage:
    return ChatMessage(
        id=model.id,
        shift_id=model.shift_id,
        sender_user_id=model.sender_user_id,
        body=model.body,
        read=model.read,
        created_at=model.created_at,
    )


class SqlAlchemyChatMessageRepository(ChatMessageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, message: ChatMessage) -> ChatMessage:
        model = ChatMessageModel(
            id=message.id,
            shift_id=message.shift_id,
            sender_user_id=message.sender_user_id,
            body=message.body,
            read=message.read,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def list_by_shift(self, shift_id: UUID) -> list[ChatMessage]:
        stmt = (
            select(ChatMessageModel)
            .where(ChatMessageModel.shift_id == shift_id)
            .order_by(ChatMessageModel.created_at.asc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def last_message(self, shift_id: UUID) -> ChatMessage | None:
        stmt = (
            select(ChatMessageModel)
            .where(ChatMessageModel.shift_id == shift_id)
            .order_by(ChatMessageModel.created_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        model = result.scalars().first()
        return _to_entity(model) if model is not None else None

    async def count_unread(self, shift_id: UUID, recipient_user_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(ChatMessageModel)
            .where(
                ChatMessageModel.shift_id == shift_id,
                ChatMessageModel.sender_user_id != recipient_user_id,
                ChatMessageModel.read.is_(False),
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def mark_read(self, shift_id: UUID, recipient_user_id: UUID) -> bool:
        stmt = (
            update(ChatMessageModel)
            .where(
                ChatMessageModel.shift_id == shift_id,
                ChatMessageModel.sender_user_id != recipient_user_id,
                ChatMessageModel.read.is_(False),
            )
            .values(read=True)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount > 0

    # --- Inbox agregado (evita el N+1 de `list_conversations`, P1) ---

    async def list_inbox_candidates(self, user_id: UUID) -> list[InboxCandidate]:
        # Un solo JOIN turno-comercio-trabajador-usuario. El INNER JOIN con
        # WorkerProfileModel ya descarta los turnos sin trabajador asignado
        # (no hay chat hasta la asignación), y el WHERE deja sólo los turnos
        # donde el usuario es el comercio o el trabajador.
        stmt = (
            select(
                ShiftModel.id,
                ShiftModel.title,
                ShiftModel.position,
                CompanyProfileModel.user_id,
                CompanyProfileModel.name,
                CompanyProfileModel.logo_url,
                WorkerProfileModel.user_id,
                UserModel.full_name,
                WorkerProfileModel.photo_url,
            )
            .join(CompanyProfileModel, CompanyProfileModel.id == ShiftModel.company_id)
            .join(
                WorkerProfileModel,
                WorkerProfileModel.id == ShiftModel.worker_profile_id,
            )
            .join(UserModel, UserModel.id == WorkerProfileModel.user_id)
            .where(
                or_(
                    CompanyProfileModel.user_id == user_id,
                    WorkerProfileModel.user_id == user_id,
                )
            )
        )
        result = await self._session.execute(stmt)
        return [
            InboxCandidate(
                shift_id=shift_id,
                shift_title=title or position,
                company_user_id=company_user_id,
                company_name=company_name,
                company_logo_url=company_logo_url,
                worker_user_id=worker_user_id,
                worker_full_name=worker_full_name,
                worker_photo_url=worker_photo_url,
            )
            for (
                shift_id,
                title,
                position,
                company_user_id,
                company_name,
                company_logo_url,
                worker_user_id,
                worker_full_name,
                worker_photo_url,
            ) in result.all()
        ]

    async def last_messages(self, shift_ids: list[UUID]) -> dict[UUID, ChatMessage]:
        if not shift_ids:
            return {}
        # "Última fila por grupo" con ROW_NUMBER(): portable entre SQLite
        # (≥3.25) y Postgres, a diferencia de DISTINCT ON (sólo Postgres).
        row_number = (
            func.row_number()
            .over(
                partition_by=ChatMessageModel.shift_id,
                order_by=ChatMessageModel.created_at.desc(),
            )
            .label("rn")
        )
        subq = (
            select(ChatMessageModel, row_number)
            .where(ChatMessageModel.shift_id.in_(shift_ids))
            .subquery()
        )
        last_message = aliased(ChatMessageModel, subq)
        stmt = select(last_message).where(subq.c.rn == 1)
        result = await self._session.execute(stmt)
        return {m.shift_id: _to_entity(m) for m in result.scalars().all()}

    async def unread_counts_by_shift(
        self, shift_ids: list[UUID], recipient_user_id: UUID
    ) -> dict[UUID, int]:
        if not shift_ids:
            return {}
        stmt = (
            select(ChatMessageModel.shift_id, func.count())
            .where(
                ChatMessageModel.shift_id.in_(shift_ids),
                ChatMessageModel.sender_user_id != recipient_user_id,
                ChatMessageModel.read.is_(False),
            )
            .group_by(ChatMessageModel.shift_id)
        )
        result = await self._session.execute(stmt)
        return {shift_id: count for shift_id, count in result.all()}
