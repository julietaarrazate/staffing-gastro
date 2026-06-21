"""Dependencias de FastAPI del módulo notification."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.notification.application.services import NotificationService
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)


def get_notification_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> NotificationService:
    repository = SqlAlchemyNotificationRepository(session)
    return NotificationService(repository)
