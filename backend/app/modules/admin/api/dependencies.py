"""Dependencias de FastAPI para el módulo de administración."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.admin.application.services import AdminService
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionRepository,
)
from app.modules.worker.infrastructure.repositories import SqlAlchemyWorkerProfileRepository


def get_admin_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AdminService:
    return AdminService(
        SqlAlchemyUserRepository(session),
        SqlAlchemyShiftRepository(session),
        SqlAlchemyWorkerProfileRepository(session),
        SqlAlchemyCompanyProfileRepository(session),
        SqlAlchemyShiftApplicationRepository(session),
        SqlAlchemySubscriptionRepository(session),
    )
