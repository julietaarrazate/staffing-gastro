"""Dependencias de FastAPI del módulo assistant."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.assistant.application.services import AssistantService
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository


def get_assistant_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AssistantService:
    return AssistantService(shifts=SqlAlchemyShiftRepository(session))
