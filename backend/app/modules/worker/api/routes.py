"""Rutas HTTP del módulo worker (perfil del trabajador)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole
from app.modules.verification.api.dependencies import get_verification_service
from app.modules.verification.application.services import VerificationService
from app.modules.worker.api.dependencies import get_user_repository, get_worker_service
from app.modules.worker.api.schemas import (
    WorkerEarningsResponse,
    WorkerProfileInput,
    WorkerProfileResponse,
)
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.exceptions import (
    WorkerProfileAlreadyExistsError,
    WorkerProfileNotFoundError,
)

router = APIRouter(prefix="/workers", tags=["workers"])

ServiceDep = Annotated[WorkerProfileService, Depends(get_worker_service)]
UsersDep = Annotated[UserRepository, Depends(get_user_repository)]
VerificationDep = Annotated[VerificationService, Depends(get_verification_service)]
WorkerDep = Annotated[User, Depends(require_roles(UserRole.WORKER))]


def _to_data(payload: WorkerProfileInput) -> WorkerProfileData:
    return WorkerProfileData(**payload.model_dump())


async def _to_response(
    profile: WorkerProfile, users: UserRepository, verification: VerificationService
) -> WorkerProfileResponse:
    user = await users.get_by_id(profile.user_id)
    response = WorkerProfileResponse.model_validate(profile)
    response.full_name = user.full_name if user else None
    verified = await verification.verified_user_ids([profile.user_id])
    response.identidad_verificada = profile.user_id in verified
    return response


@router.post(
    "/me/profile",
    response_model=WorkerProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear mi perfil de trabajador",
)
async def create_my_profile(
    payload: WorkerProfileInput, current_user: WorkerDep, service: ServiceDep, users: UsersDep, verification: VerificationDep
):
    try:
        profile = await service.create_profile(current_user.id, _to_data(payload))
    except WorkerProfileAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El perfil de trabajador ya existe",
        ) from exc
    return await _to_response(profile, users, verification)


@router.get(
    "/me/profile",
    response_model=WorkerProfileResponse,
    summary="Ver mi perfil de trabajador",
)
async def get_my_profile(
    current_user: WorkerDep,
    service: ServiceDep,
    users: UsersDep,
    verification: VerificationDep,
):
    try:
        profile = await service.get_my_profile(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return await _to_response(profile, users, verification)


@router.put(
    "/me/profile",
    response_model=WorkerProfileResponse,
    summary="Actualizar mi perfil de trabajador",
)
async def update_my_profile(
    payload: WorkerProfileInput, current_user: WorkerDep, service: ServiceDep, users: UsersDep, verification: VerificationDep
):
    try:
        profile = await service.update_profile(current_user.id, _to_data(payload))
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return await _to_response(profile, users, verification)


@router.get(
    "/me/earnings",
    response_model=WorkerEarningsResponse,
    summary="Resumen de ganancias del trabajador autenticado",
)
async def get_my_earnings(current_user: WorkerDep, service: ServiceDep):
    try:
        summary = await service.get_my_earnings_summary(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc
    return WorkerEarningsResponse(
        total_earned=summary.total_earned,
        this_month_earned=summary.this_month_earned,
        shifts_completed=summary.shifts_completed,
    )


@router.get(
    "/{profile_id}",
    response_model=WorkerProfileResponse,
    summary="Ver el perfil público de un trabajador",
)
async def get_profile(
    profile_id: UUID,
    service: ServiceDep,
    users: UsersDep,
    verification: VerificationDep,
    _current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        profile = await service.get_profile(profile_id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        ) from exc
    return await _to_response(profile, users, verification)
