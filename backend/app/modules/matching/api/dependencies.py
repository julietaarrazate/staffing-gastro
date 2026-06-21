"""Dependencias de FastAPI del módulo matching."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.matching.application.services import MatchingService
from app.modules.matching.infrastructure.repositories import (
    SqlAlchemyCandidateRepository,
)
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository


def get_matching_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MatchingService:
    shifts = SqlAlchemyShiftRepository(session)
    candidates = SqlAlchemyCandidateRepository(session)
    return MatchingService(shifts, candidates)
