"""Adaptador SQLAlchemy del ChatMessageRepository.

Además de la mensajería 1-1 (`chat_messages`), este repo resuelve el inbox
agregado (`list_inbox_candidates` + `last_messages` + `unread_counts`)
con JOINs a `shifts`/`company_profiles`/`worker_profiles`/`users` en vez de
una consulta por conversación (fix de P1 en `docs/audits/PERFORMANCE_REPORT.md`).
Importar modelos de otros módulos en infraestructura para armar estos JOINs
de lectura ya es un patrón establecido en el repo (ver
`matching/infrastructure/repositories.py`).
"""

from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.modules.chat.domain.entities import ChatMessage, InboxCandidate, Thread
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
        worker_user_id=model.worker_user_id,
        sender_user_id=model.sender_user_id,
        body=model.body,
        read=model.read,
        created_at=model.created_at,
    )


def _in_thread(thread: Thread) -> ColumnElement[bool]:
    """Filtro de un hilo. Toda lectura de mensajes pasa por acá o por
    `_in_threads`: los mensajes sin hilo (`worker_user_id` NULL) y los de otra
    persona que tuvo el mismo turno quedan afuera por construcción."""
    return (ChatMessageModel.shift_id == thread.shift_id) & (
        ChatMessageModel.worker_user_id == thread.worker_user_id
    )


def _in_threads(threads: list[Thread]) -> ColumnElement[bool]:
    return tuple_(ChatMessageModel.shift_id, ChatMessageModel.worker_user_id).in_(
        [(thread.shift_id, thread.worker_user_id) for thread in threads]
    )


class SqlAlchemyChatMessageRepository(ChatMessageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, message: ChatMessage) -> ChatMessage:
        model = ChatMessageModel(
            id=message.id,
            shift_id=message.shift_id,
            worker_user_id=message.worker_user_id,
            sender_user_id=message.sender_user_id,
            body=message.body,
            read=message.read,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def list_by_thread(self, thread: Thread) -> list[ChatMessage]:
        stmt = (
            select(ChatMessageModel)
            .where(_in_thread(thread))
            .order_by(ChatMessageModel.created_at.asc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def mark_read(self, thread: Thread, reader_user_id: UUID) -> bool:
        stmt = (
            update(ChatMessageModel)
            .where(
                _in_thread(thread),
                ChatMessageModel.sender_user_id != reader_user_id,
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

    async def last_messages(self, threads: list[Thread]) -> dict[Thread, ChatMessage]:
        if not threads:
            return {}
        # "Última fila por grupo" con ROW_NUMBER(): portable entre SQLite
        # (≥3.25) y Postgres, a diferencia de DISTINCT ON (sólo Postgres).
        row_number = (
            func.row_number()
            .over(
                partition_by=(ChatMessageModel.shift_id, ChatMessageModel.worker_user_id),
                order_by=ChatMessageModel.created_at.desc(),
            )
            .label("rn")
        )
        subq = select(ChatMessageModel, row_number).where(_in_threads(threads)).subquery()
        last_message = aliased(ChatMessageModel, subq)
        stmt = select(last_message).where(subq.c.rn == 1)
        result = await self._session.execute(stmt)
        messages = [_to_entity(m) for m in result.scalars().all()]
        return {message.thread: message for message in messages}

    async def unread_counts(
        self, threads: list[Thread], recipient_user_id: UUID
    ) -> dict[Thread, int]:
        if not threads:
            return {}
        stmt = (
            select(
                ChatMessageModel.shift_id,
                ChatMessageModel.worker_user_id,
                func.count(),
            )
            .where(
                _in_threads(threads),
                ChatMessageModel.sender_user_id != recipient_user_id,
                ChatMessageModel.read.is_(False),
            )
            .group_by(ChatMessageModel.shift_id, ChatMessageModel.worker_user_id)
        )
        result = await self._session.execute(stmt)
        return {
            Thread(shift_id=shift_id, worker_user_id=worker_user_id): count
            for shift_id, worker_user_id, count in result.all()
        }
