"""Rutas HTTP del módulo de administración.

Todas las rutas exigen rol ADMIN. La moderación de usuarios (suspender,
reactivar, verificar, promover) reutiliza el repositorio de identidad.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.log_privacy import mask_email
from app.modules.admin.api.dependencies import get_admin_service
from app.modules.admin.api.schemas import (
    AdminUserDetailResponse,
    AdminUserResponse,
    ImpersonateResponse,
    LiveShiftsResponse,
    PeriodMetricsResponse,
    PlatformStatsResponse,
    SubscriptionStatsResponse,
    TestAccountResponse,
    TodayCountsResponse,
)
from app.modules.admin.application.exceptions import (
    CannotImpersonateAdminError,
    CannotModifySelfError,
    TargetUserNotFoundError,
)
from app.modules.admin.application.periods import METRICS_PERIODS
from app.modules.admin.application.services import AdminService
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole, UserStatus

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

ServiceDep = Annotated[AdminService, Depends(get_admin_service)]
AdminDep = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
LimitDep = Annotated[int, Query(ge=1, le=100)]
OffsetDep = Annotated[int, Query(ge=0)]


@router.get("/stats", response_model=PlatformStatsResponse, summary="Métricas de la plataforma")
async def stats(_: AdminDep, service: ServiceDep):
    return await service.get_stats()


@router.get(
    "/today",
    response_model=TodayCountsResponse,
    summary='Portada "Hoy": urgentes sin cubrir y ausencias del día',
)
async def today(_: AdminDep, service: ServiceDep):
    return await service.get_today_counts()


@router.get(
    "/live-shifts",
    response_model=LiveShiftsResponse,
    summary="Turnos en vivo: publicados y sin nadie confirmado, lo más urgente primero",
)
async def live_shifts(
    _: AdminDep,
    service: ServiceDep,
    urgent: bool = False,
    escalated: bool = False,
):
    return await service.list_live_shifts(urgent_only=urgent, escalated_only=escalated)


@router.get(
    "/period-metrics",
    response_model=PeriodMetricsResponse,
    summary="Métricas de los últimos 7 o 30 días contra el período anterior",
)
async def period_metrics(
    _: AdminDep,
    service: ServiceDep,
    period: Annotated[int, Query(description="Días: 7 o 30")] = 7,
):
    if period not in METRICS_PERIODS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El período tiene que ser de 7 o 30 días",
        )
    return await service.get_period_metrics(period)


@router.get(
    "/test-accounts",
    response_model=list[TestAccountResponse],
    summary="Cuentas de prueba (trabajador/comercio) para \"Ver como\"",
)
async def test_accounts(_: AdminDep, service: ServiceDep):
    return await service.get_or_create_test_accounts()


@router.get(
    "/subscription-stats",
    response_model=SubscriptionStatsResponse,
    summary="Métricas de suscripción/mensualidad (MRR, distribución por plan)",
)
async def subscription_stats(_: AdminDep, service: ServiceDep):
    return await service.get_subscription_stats()


@router.get("/users", response_model=list[AdminUserResponse], summary="Listar usuarios")
async def list_users(
    _: AdminDep,
    service: ServiceDep,
    limit: LimitDep = 50,
    offset: OffsetDep = 0,
    q: Annotated[str | None, Query(max_length=100, description="Nombre o email")] = None,
    role: UserRole | None = None,
    user_status: Annotated[UserStatus | None, Query(alias="status")] = None,
    verified: bool | None = None,
):
    return await service.list_users(
        limit=limit,
        offset=offset,
        search=q,
        role=role,
        status=user_status,
        verified=verified,
    )


@router.get(
    "/users/{user_id}",
    response_model=AdminUserDetailResponse,
    summary="Ficha de una persona: perfil, turnos y tickets recientes",
)
async def get_user_detail(user_id: UUID, _: AdminDep, service: ServiceDep):
    try:
        return await service.get_user_detail(user_id)
    except TargetUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from exc


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


@router.post(
    "/users/{user_id}/impersonate",
    response_model=ImpersonateResponse,
    summary='"Ver como": entrar a la cuenta de un usuario para testing/soporte (admin)',
)
async def impersonate_user(user_id: UUID, current: AdminDep, service: ServiceDep):
    try:
        user, access_token = await service.impersonate(user_id)
    except TargetUserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from exc
    except CannotImpersonateAdminError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede ver la app como otra cuenta de administrador",
        ) from exc
    # Auditoría: quién vio la app como quién y cuándo (dato sensible — un
    # admin accede a la cuenta de un usuario real). Ver ADR pendiente si esto
    # necesita persistirse en tabla además del log.
    logger.warning(
        "admin impersonate: admin=%s (%s) → target=%s (%s, rol=%s)",
        current.id,
        mask_email(current.email),
        user.id,
        mask_email(user.email),
        user.role.value,
    )
    return ImpersonateResponse(
        access_token=access_token, user=AdminUserResponse.model_validate(user)
    )
