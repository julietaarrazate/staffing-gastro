"""Dependencias de FastAPI del módulo support."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.support.application.services import SupportService
from app.modules.support.infrastructure.repositories import (
    SqlAlchemySupportMessageRepository,
    SqlAlchemySupportTicketRepository,
)


def get_support_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SupportService:
    return SupportService(
        tickets=SqlAlchemySupportTicketRepository(session),
        messages=SqlAlchemySupportMessageRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
    )
