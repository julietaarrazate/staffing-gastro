"""Dependencias de FastAPI del módulo application."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.application.application.services import ApplicationService
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository


def get_application_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationService:
    return ApplicationService(
        applications=SqlAlchemyShiftApplicationRepository(session),
        shifts=SqlAlchemyShiftRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
    )
