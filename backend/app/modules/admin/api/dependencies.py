"""Dependencias de FastAPI para el módulo de administración."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.admin.application.services import AdminService
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository


def get_admin_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AdminService:
    return AdminService(SqlAlchemyUserRepository(session))
