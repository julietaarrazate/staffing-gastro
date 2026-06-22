"""Dependencias de FastAPI del módulo worker."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)


def get_worker_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkerProfileService:
    repository = SqlAlchemyWorkerProfileRepository(session)
    return WorkerProfileService(repository)


def get_user_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserRepository:
    return SqlAlchemyUserRepository(session)
