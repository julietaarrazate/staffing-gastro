"""Adaptador SQLAlchemy del `AssistantQueryLogRepository`."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.assistant.domain.entities import AssistantQueryLogEntry
from app.modules.assistant.domain.repositories import AssistantQueryLogRepository
from app.modules.assistant.infrastructure.models import AssistantQueryLogModel


class SqlAlchemyAssistantQueryLogRepository(AssistantQueryLogRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, entry: AssistantQueryLogEntry) -> None:
        model = AssistantQueryLogModel(
            id=entry.id,
            company_id=entry.company_id,
            text=entry.text,
            intent=entry.intent,
        )
        self._session.add(model)
        await self._session.commit()
