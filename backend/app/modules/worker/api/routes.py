"""Rutas HTTP del módulo worker (perfil del trabajador)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.worker.api.dependencies import get_worker_service
from app.modules.worker.api.schemas import (
    WorkerProfileInput,
    WorkerProfileResponse,
)
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.exceptions import (
    WorkerProfileAlreadyExistsError,
    WorkerProfileNotFoundError,
)

router = APIRouter(prefix="/workers", tags=["workers"])

ServiceDep = Annotated[WorkerProfileService, Depends(get_worker_service)]
WorkerDep = Annotated[User, Depends(require_roles(UserRole.WORKER))]


def _to_data(payload: WorkerProfileInput) -> WorkerProfileData:
    return WorkerProfileData(**payload.model_dump())


@router.post(
    "/me/profile",
    response_model=WorkerProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear mi perfil de trabajador",
)
async def create_my_profile(
    payload: WorkerProfileInput, current_user: WorkerDep, service: ServiceDep
):
    try:
        return await service.create_profile(current_user.id, _to_data(payload))
    except WorkerProfileAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El perfil de trabajador ya existe",
        ) from exc


@router.get(
    "/me/profile",
    response_model=WorkerProfileResponse,
    summary="Ver mi perfil de trabajador",
)
async def get_my_profile(current_user: WorkerDep, service: ServiceDep):
    try:
        return await service.get_my_profile(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc


@router.put(
    "/me/profile",
    response_model=WorkerProfileResponse,
    summary="Actualizar mi perfil de trabajador",
)
async def update_my_profile(
    payload: WorkerProfileInput, current_user: WorkerDep, service: ServiceDep
):
    try:
        return await service.update_profile(current_user.id, _to_data(payload))
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de trabajador",
        ) from exc


@router.get(
    "/{profile_id}",
    response_model=WorkerProfileResponse,
    summary="Ver el perfil público de un trabajador",
)
async def get_profile(
    profile_id: UUID,
    service: ServiceDep,
    _current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return await service.get_profile(profile_id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        ) from exc
