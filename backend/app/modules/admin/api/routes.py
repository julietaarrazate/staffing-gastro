"""Rutas HTTP del módulo de administración.

Todas las rutas exigen rol ADMIN. La moderación de usuarios (suspender,
reactivar, verificar, promover) reutiliza el repositorio de identidad.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.modules.admin.api.dependencies import get_admin_service
from app.modules.admin.api.schemas import AdminUserResponse, PlatformStatsResponse
from app.modules.admin.application.exceptions import (
    CannotModifySelfError,
    TargetUserNotFoundError,
)
from app.modules.admin.application.services import AdminService
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

ServiceDep = Annotated[AdminService, Depends(get_admin_service)]
AdminDep = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]


@router.get("/stats", response_model=PlatformStatsResponse, summary="Métricas de la plataforma")
async def stats(_: AdminDep, service: ServiceDep):
    return await service.get_stats()


@router.get("/users", response_model=list[AdminUserResponse], summary="Listar usuarios")
async def list_users(
    _: AdminDep, service: ServiceDep, limit: LimitDep = 50, offset: OffsetDep = 0
):
    return await service.list_users(limit=limit, offset=offset)


@router.post(
    "/users/{user_id}/suspend",
    response_model=AdminUserResponse,
    summary="Suspender un usuario",
)
async def suspend_user(user_id: UUID, current: AdminDep, service: ServiceDep):
    try:
        result = await service.suspend_user(current, user_id)
    except CannotModifySelfError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés suspender tu propia cuenta",
        ) from exc
    except TargetUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from exc
    logger.warning("admin suspend_user: admin=%s target=%s", current.id, user_id)
    return result


@router.post(
    "/users/{user_id}/activate",
    response_model=AdminUserResponse,
    summary="Reactivar un usuario",
)
async def activate_user(user_id: UUID, current: AdminDep, service: ServiceDep):
    try:
        result = await service.activate_user(user_id)
    except TargetUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from exc
    logger.warning("admin activate_user: admin=%s target=%s", current.id, user_id)
    return result


@router.post(
    "/users/{user_id}/verify",
    response_model=AdminUserResponse,
    summary="Verificar un usuario",
)
async def verify_user(user_id: UUID, current: AdminDep, service: ServiceDep):
    try:
        result = await service.verify_user(user_id)
    except TargetUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from exc
    logger.info("admin verify_user: admin=%s target=%s", current.id, user_id)
    return result


@router.post(
    "/users/{user_id}/promote",
    response_model=AdminUserResponse,
    summary="Promover un usuario a administrador",
)
async def promote_user(user_id: UUID, current: AdminDep, service: ServiceDep):
    try:
        result = await service.promote_to_admin(user_id)
    except TargetUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from exc
    # Otorga rol ADMIN — el evento de mayor sensibilidad de todo este router.
    logger.warning("admin promote_user: admin=%s target=%s → ADMIN", current.id, user_id)
    return result
