"""Dependencias de FastAPI del módulo de verificación de identidad."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.verification.application.services import VerificationService
from app.modules.verification.infrastructure.repositories import (
    SqlAlchemyClaimRepository,
)


def get_verification_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> VerificationService:
    return VerificationService(SqlAlchemyClaimRepository(session))
