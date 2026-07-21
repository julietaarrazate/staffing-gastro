"""Dependencias de FastAPI del módulo notification."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_session
from app.modules.notification.application.services import NotificationService, PushService
from app.modules.notification.domain.email_sender import EmailSender
from app.modules.notification.infrastructure.null_email_sender import NullEmailSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
    SqlAlchemyPushSubscriptionRepository,
)
from app.modules.notification.infrastructure.resend_email_sender import (
    ResendEmailSender,
)


def get_notification_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> NotificationService:
    repository = SqlAlchemyNotificationRepository(session)
    return NotificationService(repository)


def get_push_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PushService:
    repository = SqlAlchemyPushSubscriptionRepository(session)
    return PushService(repository)


def get_email_sender() -> EmailSender:
    """Sin `RESEND_API_KEY` configurada, inyecta `NullEmailSender` (no-op que
    sólo loguea): el envío de email nunca debe romper un flujo de negocio ni
    bloquear un deploy sin cuenta de Resend todavía (ver `core/config.py`)."""
    if app_settings.resend_api_key:
        return ResendEmailSender(app_settings)
    return NullEmailSender()
