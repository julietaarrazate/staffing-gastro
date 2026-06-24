"""Rutas HTTP del módulo company (perfil del comercio)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.company.api.dependencies import (
    get_company_service,
    get_user_repository,
)
from app.modules.company.api.schemas import (
    CompanyProfileInput,
    CompanyProfileResponse,
)
from app.modules.company.application.dtos import CompanyProfileData
from app.modules.company.application.services import CompanyProfileService
from app.modules.company.domain.entities import CompanyProfile
from app.modules.company.domain.exceptions import (
    CompanyProfileAlreadyExistsError,
    CompanyProfileNotFoundError,
)
from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/companies", tags=["companies"])

ServiceDep = Annotated[CompanyProfileService, Depends(get_company_service)]
UsersDep = Annotated[UserRepository, Depends(get_user_repository)]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]


def _to_data(payload: CompanyProfileInput) -> CompanyProfileData:
    return CompanyProfileData(**payload.model_dump())


async def _to_response(profile: CompanyProfile, users: UserRepository) -> CompanyProfileResponse:
    user = await users.get_by_id(profile.user_id)
    response = CompanyProfileResponse.model_validate(profile)
    response.owner_full_name = user.full_name if user else None
    return response


@router.post(
    "/me/profile",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear mi perfil de comercio",
)
async def create_my_profile(
    payload: CompanyProfileInput, current_user: EmployerDep, service: ServiceDep, users: UsersDep
):
    try:
        profile = await service.create_profile(current_user.id, _to_data(payload))
    except CompanyProfileAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El perfil de comercio ya existe",
        ) from exc
    return await _to_response(profile, users)


@router.get(
    "/me/profile",
    response_model=CompanyProfileResponse,
    summary="Ver mi perfil de comercio",
)
async def get_my_profile(current_user: EmployerDep, service: ServiceDep, users: UsersDep):
    try:
        profile = await service.get_my_profile(current_user.id)
    except CompanyProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de comercio",
        ) from exc
    return await _to_response(profile, users)


@router.put(
    "/me/profile",
    response_model=CompanyProfileResponse,
    summary="Actualizar mi perfil de comercio",
)
async def update_my_profile(
    payload: CompanyProfileInput, current_user: EmployerDep, service: ServiceDep, users: UsersDep
):
    try:
        profile = await service.update_profile(current_user.id, _to_data(payload))
    except CompanyProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de comercio",
        ) from exc
    return await _to_response(profile, users)


@router.get(
    "/{profile_id}",
    response_model=CompanyProfileResponse,
    summary="Ver el perfil público de un comercio",
)
async def get_profile(
    profile_id: UUID,
    service: ServiceDep,
    users: UsersDep,
    _current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        profile = await service.get_profile(profile_id)
    except CompanyProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil no encontrado",
        ) from exc
    return await _to_response(profile, users)
