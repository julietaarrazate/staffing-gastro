"""Dependencias de FastAPI del módulo company."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.company.application.services import CompanyProfileService
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository


def get_company_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CompanyProfileService:
    repository = SqlAlchemyCompanyProfileRepository(session)
    return CompanyProfileService(repository)


def get_user_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserRepository:
    return SqlAlchemyUserRepository(session)
