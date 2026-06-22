"""Dependencias de FastAPI del módulo chat."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.chat.application.services import ChatService
from app.modules.chat.infrastructure.repositories import (
    SqlAlchemyChatMessageRepository,
)
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyUserRepository,
)
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)


def get_chat_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ChatService:
    return ChatService(
        messages=SqlAlchemyChatMessageRepository(session),
        shifts=SqlAlchemyShiftRepository(session),
        workers=SqlAlchemyWorkerProfileRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        users=SqlAlchemyUserRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
    )
