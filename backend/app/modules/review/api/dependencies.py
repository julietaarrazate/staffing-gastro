"""Dependencias de FastAPI del módulo review."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.review.application.services import ReviewService
from app.modules.review.infrastructure.repositories import SqlAlchemyReviewRepository
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)


def get_review_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReviewService:
    return ReviewService(
        reviews=SqlAlchemyReviewRepository(session),
        shifts=SqlAlchemyShiftRepository(session),
        workers=SqlAlchemyWorkerProfileRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
    )
