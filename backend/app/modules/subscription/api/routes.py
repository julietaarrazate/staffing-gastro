"""Rutas HTTP del módulo subscription (Fase 1 ADR-0005: mensualidad)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.idempotency import IdempotencyRecorder, idempotent
from app.modules.identity.api.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.subscription.api.dependencies import (
    get_my_company_id,
    get_subscription_service,
)
from app.modules.subscription.api.schemas import (
    PlanResponse,
    PlansResponse,
    SubscribeRequest,
    SubscribeResponse,
    SubscriptionResponse,
)
from app.modules.subscription.application.services import SubscriptionService
from app.modules.subscription.domain.exceptions import UnknownPlanError
from app.modules.subscription.domain.plans import get_plan

router = APIRouter(prefix="/subscription", tags=["subscription"])

ServiceDep = Annotated[SubscriptionService, Depends(get_subscription_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
# Idempotencia (product/IDEMPOTENCIA_SPEC.md): sólo la ruta, nunca la lógica
# de conteo mensual (esa vive en ShiftService/SubscriptionService — frontera
# del ejecutor paralelo en `claude/robustez-tz-bugs`).
RecorderDep = Annotated[IdempotencyRecorder, Depends(idempotent)]


@router.get("", response_model=SubscriptionResponse, summary="Ver mi suscripción")
async def get_my_subscription(company_id: CompanyIdDep, service: ServiceDep):
    subscription = await service.get_my_subscription(company_id)
    plan = get_plan(subscription.plan_code)
    return SubscriptionResponse(
        plan_code=subscription.plan_code,
        status=subscription.status.value,
        period_end=subscription.period_end,
        price_ars=plan.price_ars,
        max_turnos_mes=plan.max_turnos_mes,
        turnos_usados_mes=subscription.turnos_usados_mes,
    )


@router.get(
    "/plans", response_model=PlansResponse, summary="Ver los planes disponibles"
)
async def get_plans(_current_user: EmployerDep, service: ServiceDep):
    return PlansResponse(
        plans=[
            PlanResponse(
                code=plan.code,
                name=plan.name,
                price_ars=plan.price_ars,
                max_turnos_mes=plan.max_turnos_mes,
                features=list(plan.features),
            )
            for plan in service.list_plans()
        ]
    )


@router.post(
    "/subscribe", response_model=SubscribeResponse, summary="Suscribirse a un plan"
)
async def subscribe(
    payload: SubscribeRequest,
    company_id: CompanyIdDep,
    current_user: CurrentUserDep,
    service: ServiceDep,
    recorder: RecorderDep,
):
    try:
        result = await service.subscribe(
            company_id, payload.plan_code, payer_email=current_user.email
        )
    except UnknownPlanError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    response = SubscribeResponse(
        plan_code=result.plan_code, status=result.status, checkout_url=result.checkout_url
    )
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response
