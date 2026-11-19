"""Adaptador SQLAlchemy del ReviewRepository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.review.domain.entities import Review
from app.modules.review.domain.exceptions import DuplicateReviewError
from app.modules.review.domain.repositories import ReviewRepository
from app.modules.review.infrastructure.models import ReviewModel


def _to_entity(model: ReviewModel) -> Review:
    return Review(
        id=model.id,
        shift_id=model.shift_id,
        reviewer_user_id=model.reviewer_user_id,
        reviewee_user_id=model.reviewee_user_id,
        rating=model.rating,
        comment=model.comment,
        created_at=model.created_at,
    )


class SqlAlchemyReviewRepository(ReviewRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, review: Review) -> Review:
        model = ReviewModel(
            id=review.id,
            shift_id=review.shift_id,
            reviewer_user_id=review.reviewer_user_id,
            reviewee_user_id=review.reviewee_user_id,
            rating=review.rating,
            comment=review.comment,
        )
        self._session.add(model)
        try:
            await self._session.commit()
        except IntegrityError:
            # La sesión queda inválida hasta el `rollback`.
            await self._session.rollback()
            # Dos envíos a la vez (dos dispositivos) pasaron el chequeo de
            # «ya calificó» y la fila única por turno y calificador frenó al
            # segundo: es el mismo caso que calificar de nuevo, no un 500.
            if await self.get_by_shift_and_reviewer(review.shift_id, review.reviewer_user_id):
                raise DuplicateReviewError(str(review.shift_id)) from None
            raise
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_shift_and_reviewer(
        self, shift_id: UUID, reviewer_user_id: UUID
    ) -> Review | None:
        stmt = select(ReviewModel).where(
            ReviewModel.shift_id == shift_id,
            ReviewModel.reviewer_user_id == reviewer_user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_by_shift(self, shift_id: UUID) -> list[Review]:
        stmt = select(ReviewModel).where(ReviewModel.shift_id == shift_id)
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_received_by_user(self, user_id: UUID) -> list[Review]:
        stmt = (
            select(ReviewModel)
            .where(ReviewModel.reviewee_user_id == user_id)
            .order_by(ReviewModel.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [_to_entity(m) for m in result.scalars().all()]

    async def average_rating(self, user_id: UUID) -> float:
        stmt = select(func.avg(ReviewModel.rating)).where(
            ReviewModel.reviewee_user_id == user_id
        )
        result = await self._session.execute(stmt)
        average = result.scalar_one()
        return float(average) if average is not None else 0.0
