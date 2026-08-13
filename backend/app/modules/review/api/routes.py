"""Rutas HTTP del módulo review (calificación bidireccional por turno)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.idempotency import IdempotencyRecorder, idempotent
from app.modules.identity.api.dependencies import get_current_user
from app.modules.identity.domain.entities import User
from app.modules.review.api.dependencies import get_review_service
from app.modules.review.api.schemas import ReviewResponse, SubmitReviewRequest
from app.modules.review.application.services import ReviewService
from app.modules.review.domain.exceptions import (
    DuplicateReviewError,
    InvalidRatingError,
    ShiftNotReviewableError,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])

ServiceDep = Annotated[ReviewService, Depends(get_review_service)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
# Idempotencia (product/IDEMPOTENCIA_SPEC.md).
RecorderDep = Annotated[IdempotencyRecorder, Depends(idempotent)]

_NOT_REVIEWABLE = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Turno no encontrado o todavía no se puede calificar",
)


@router.get(
    "/received",
    response_model=list[ReviewResponse],
    summary="Reseñas que recibí (para mi reputación)",
)
async def my_received_reviews(current_user: CurrentUserDep, service: ServiceDep):
    return await service.list_received(current_user.id)


@router.get(
    "/workers/{worker_profile_id}",
    response_model=list[ReviewResponse],
    summary="Reseñas públicas de un trabajador (para vetearlo antes de asignar)",
)
async def worker_reviews(
    worker_profile_id: UUID, _current_user: CurrentUserDep, service: ServiceDep
):
    return await service.list_for_worker(worker_profile_id)


@router.get(
    "/shifts/{shift_id}",
    response_model=list[ReviewResponse],
    summary="Reseñas ya dejadas en un turno cerrado",
)
async def shift_reviews(shift_id: UUID, current_user: CurrentUserDep, service: ServiceDep):
    try:
        return await service.list_for_shift(current_user.id, shift_id)
    except ShiftNotReviewableError as exc:
        raise _NOT_REVIEWABLE from exc


@router.post(
    "/shifts/{shift_id}",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Calificar al otro participante de un turno cerrado",
)
async def submit_review(
    shift_id: UUID,
    payload: SubmitReviewRequest,
    current_user: CurrentUserDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        review = await service.submit_review(
            current_user.id, shift_id, payload.rating, payload.comment
        )
    except ShiftNotReviewableError as exc:
        raise _NOT_REVIEWABLE from exc
    except DuplicateReviewError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya calificaste este turno",
        ) from exc
    except InvalidRatingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La calificación debe ser entre 1 y 5",
        ) from exc
    response = ReviewResponse.model_validate(review)
    await recorder.save(status.HTTP_201_CREATED, response.model_dump(mode="json"))
    return response
