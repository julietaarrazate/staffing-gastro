"""Dependencias de FastAPI del módulo favorite."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.favorite.application.services import FavoriteService
from app.modules.favorite.infrastructure.repositories import SqlAlchemyFavoriteRepository
from app.modules.worker.infrastructure.repositories import SqlAlchemyWorkerProfileRepository


def get_favorite_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FavoriteService:
    return FavoriteService(
        favorites=SqlAlchemyFavoriteRepository(session),
        workers=SqlAlchemyWorkerProfileRepository(session),
    )
