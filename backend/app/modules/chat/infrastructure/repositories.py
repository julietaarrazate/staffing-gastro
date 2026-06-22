"""Adaptador SQLAlchemy del ChatMessageRepository."""

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.chat.domain.entities import ChatMessage
from app.modules.chat.domain.repositories import ChatMessageRepository
from app.modules.chat.infrastructure.models import ChatMessageModel


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

    async def mark_read(self, shift_id: UUID, recipient_user_id: UUID) -> None:
        stmt = (
            update(ChatMessageModel)
            .where(
                ChatMessageModel.shift_id == shift_id,
                ChatMessageModel.sender_user_id != recipient_user_id,
                ChatMessageModel.read.is_(False),
            )
            .values(read=True)
        )
        await self._session.execute(stmt)
        await self._session.commit()
