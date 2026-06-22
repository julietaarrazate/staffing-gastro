"""Casos de uso del módulo review (calificación bidireccional al cerrar un turno)."""

from uuid import UUID

from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.review.domain.entities import Review
from app.modules.review.domain.exceptions import (
    DuplicateReviewError,
    InvalidRatingError,
    ShiftNotReviewableError,
)
from app.modules.review.domain.repositories import ReviewRepository
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.repositories import WorkerProfileRepository

# Un turno se puede calificar una vez cerrado: trabajado (FINALIZADO) o ya
# pagado (PAGADO). No se califica un turno CANCELADO porque no se llegó a dar.
REVIEWABLE_STATUSES = frozenset({ShiftStatus.FINALIZADO, ShiftStatus.PAGADO})


class ReviewService:
    """Servicio de aplicación para las reseñas bidireccionales de un turno.

    El comercio y el trabajador asignado se califican mutuamente una sola
    vez cada uno por turno. Cada reseña nueva recalcula el promedio de
    reputación del calificado, que alimenta directamente al matching.
    """

    def __init__(
        self,
        reviews: ReviewRepository,
        shifts: ShiftRepository,
        workers: WorkerProfileRepository,
        companies: CompanyProfileRepository,
        notifications: NotificationRepository,
    ) -> None:
        self._reviews = reviews
        self._shifts = shifts
        self._workers = workers
        self._companies = companies
        self._notifications = notifications

    async def submit_review(
        self,
        reviewer_user_id: UUID,
        shift_id: UUID,
        rating: int,
        comment: str | None,
    ) -> Review:
        """Registra la calificación de un participante hacia el otro."""
        if not 1 <= rating <= 5:
            raise InvalidRatingError(str(rating))

        company_user_id, worker_user_id = await self._authorize(
            reviewer_user_id, shift_id
        )
        if await self._reviews.get_by_shift_and_reviewer(shift_id, reviewer_user_id):
            raise DuplicateReviewError(str(shift_id))

        reviewee_user_id = (
            worker_user_id if reviewer_user_id == company_user_id else company_user_id
        )
        review = await self._reviews.add(
            Review(
                shift_id=shift_id,
                reviewer_user_id=reviewer_user_id,
                reviewee_user_id=reviewee_user_id,
                rating=rating,
                comment=comment.strip() if comment else None,
            )
        )
        await self._update_aggregate_rating(reviewee_user_id)
        await self._notifications.add(
            Notification(
                user_id=reviewee_user_id,
                type=NotificationType.REVIEW_RECEIVED,
                title="Te dejaron una reseña",
                message="Calificaron tu desempeño en un turno cerrado.",
            )
        )
        return review

    async def list_for_shift(self, user_id: UUID, shift_id: UUID) -> list[Review]:
        """Reseñas ya dejadas en un turno (para saber si falta calificar)."""
        await self._authorize(user_id, shift_id)
        return await self._reviews.list_by_shift(shift_id)

    async def list_received(self, user_id: UUID) -> list[Review]:
        """Reseñas recibidas por el usuario, para mostrar en su reputación."""
        return await self._reviews.list_received_by_user(user_id)

    # --- helpers ---

    async def _authorize(self, user_id: UUID, shift_id: UUID) -> tuple[UUID, UUID]:
        """Verifica que el turno esté cerrado y el usuario sea participante."""
        shift = await self._shifts.get_by_id(shift_id)
        if shift is None or shift.status not in REVIEWABLE_STATUSES:
            raise ShiftNotReviewableError(str(shift_id))
        company_user_id, worker_user_id = await self._participants(shift)
        if user_id not in (company_user_id, worker_user_id):
            raise ShiftNotReviewableError(str(shift_id))
        return company_user_id, worker_user_id

    async def _participants(self, shift: Shift) -> tuple[UUID, UUID]:
        if shift.worker_profile_id is None:
            raise ShiftNotReviewableError(str(shift.id))
        company = await self._companies.get_by_id(shift.company_id)
        worker = await self._workers.get_by_id(shift.worker_profile_id)
        if company is None or worker is None:
            raise ShiftNotReviewableError(str(shift.id))
        return company.user_id, worker.user_id

    async def _update_aggregate_rating(self, reviewee_user_id: UUID) -> None:
        average = await self._reviews.average_rating(reviewee_user_id)
        worker = await self._workers.get_by_user_id(reviewee_user_id)
        if worker is not None:
            await self._workers.update_rating(worker.id, average)
            return
        company = await self._companies.get_by_user_id(reviewee_user_id)
        if company is not None:
            await self._companies.update_rating(company.id, average)
