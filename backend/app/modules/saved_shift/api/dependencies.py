"""Dependencias de FastAPI del módulo saved_shift."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.saved_shift.application.services import SavedShiftService
from app.modules.saved_shift.infrastructure.repositories import (
    SqlAlchemySavedShiftRepository,
)
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository


def get_saved_shift_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SavedShiftService:
    return SavedShiftService(
        saved_shifts=SqlAlchemySavedShiftRepository(session),
        shifts=SqlAlchemyShiftRepository(session),
    )
