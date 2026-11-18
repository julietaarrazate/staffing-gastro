"""Dependencias de FastAPI del módulo encuesta."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.encuesta.application.services import SurveyService
from app.modules.encuesta.infrastructure.repositories import SqlAlchemySurveyRepository


def get_survey_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SurveyService:
    return SurveyService(SqlAlchemySurveyRepository(session))
