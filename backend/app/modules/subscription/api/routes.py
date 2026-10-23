"""Rutas HTTP del módulo subscription (ADR-0005 Fase 1, ADR-0022)."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import settings as app_settings
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
    WebhookAck,
)
from app.modules.subscription.application.services import (
    SubscriptionOverview,
    SubscriptionService,
)
from app.modules.subscription.domain.exceptions import (
    BillingDisabledError,
    BillingGatewayError,
    NothingToCancelError,
    UnknownPlanError,
    WithdrawalNotAvailableError,
)
from app.modules.subscription.domain.plans import Plan, list_plans
from app.modules.subscription.infrastructure.mercadopago_signature import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscription", tags=["subscription"])

ServiceDep = Annotated[SubscriptionService, Depends(get_subscription_service)]
CompanyIdDep = Annotated[UUID, Depends(get_my_company_id)]
EmployerDep = Annotated[User, Depends(require_roles(UserRole.EMPLOYER))]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
# Idempotencia (product/IDEMPOTENCIA_SPEC.md): sólo la ruta, nunca la lógica
# de conteo mensual (esa vive en ShiftService/SubscriptionService).
RecorderDep = Annotated[IdempotencyRecorder, Depends(idempotent)]


def _plans_response(plans: list[Plan]) -> PlansResponse:
    """Arma el `PlansResponse` HTTP desde el catálogo de dominio. Compartido
    por la ruta autenticada y la pública para no duplicar el mapeo."""
    return PlansResponse(
        plans=[
            PlanResponse(
                code=plan.code,
                name=plan.name,
                price_ars=plan.price_ars,
                max_turnos_mes=plan.max_turnos_mes,
                features=list(plan.features),
            )
            for plan in plans
        ]
    )


def _subscription_response(overview: SubscriptionOverview) -> SubscriptionResponse:
    subscription = overview.subscription
    return SubscriptionResponse(
        plan_code=subscription.plan_code,
        status=subscription.status.value,
        period_end=subscription.period_end,
        price_ars=overview.plan.price_ars,
        max_turnos_mes=overview.plan.max_turnos_mes,
        turnos_usados_mes=subscription.turnos_usados_mes,
        billing_enabled=overview.billing_enabled,
        paid_until=subscription.paid_until,
        renews=subscription.renews,
        can_publish=overview.can_publish,
        withdrawal_until=overview.withdrawal_until,
    )


@router.get("", response_model=SubscriptionResponse, summary="Ver mi suscripción")
async def get_my_subscription(company_id: CompanyIdDep, service: ServiceDep):
    return _subscription_response(await service.get_overview(company_id))


@router.get(
    "/plans", response_model=PlansResponse, summary="Ver los planes disponibles"
)
async def get_plans(_current_user: EmployerDep, service: ServiceDep):
    return _plans_response(service.list_plans())


# 5 minutos: un cambio de precios (que sale con un deploy) tarda como mucho
# eso en verse en la landing.
PUBLIC_PLANS_CACHE_CONTROL = "public, max-age=300"


@router.get(
    "/plans/public",
    response_model=PlansResponse,
    summary="Ver los planes disponibles (público, sin auth)",
)
async def get_plans_public(response: Response):
    """Catálogo de planes para la landing / página pública (feedback de
    Julieta 2026-08-06: "no queda claro qué costo tiene la plataforma en la
    versión sin cuenta"). Son datos de configuración (`plans.py`), sin nada
    por-comercio, así que no requieren sesión — misma forma que `/plans` pero
    sin el gate de employer.

    Cacheable 5 minutos por el navegador y cualquier caché compartida
    (2026-10-23): es igual para todos y sólo cambia con un deploy, así que
    quien vuelve a la landing no tiene que despertar a Render para pedirlo."""
    response.headers["Cache-Control"] = PUBLIC_PLANS_CACHE_CONTROL
    return _plans_response(list_plans())


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
    except BillingGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    response = SubscribeResponse(
        plan_code=result.plan_code, status=result.status, checkout_url=result.checkout_url
    )
    await recorder.save(status.HTTP_200_OK, response.model_dump(mode="json"))
    return response


@router.post(
    "/cancel-renewal",
    response_model=SubscriptionResponse,
    summary="Dar de baja (no renovar; el plan sigue hasta el fin del mes pago)",
)
async def cancel_renewal(company_id: CompanyIdDep, service: ServiceDep):
    try:
        await service.cancel_renewal(company_id)
    except (BillingDisabledError, NothingToCancelError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _subscription_response(await service.get_overview(company_id))


@router.post(
    "/withdraw",
    response_model=SubscriptionResponse,
    summary="Arrepentimiento: devolución del primer mes dentro de los 10 días",
)
async def withdraw(company_id: CompanyIdDep, service: ServiceDep):
    try:
        await service.withdraw(company_id)
    except (BillingDisabledError, WithdrawalNotAvailableError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except BillingGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _subscription_response(await service.get_overview(company_id))


@router.post(
    "/webhooks/mercadopago",
    response_model=WebhookAck,
    summary="Webhook de pagos de Mercado Pago (firma x-signature)",
    include_in_schema=False,
)
async def mercadopago_webhook(request: Request, service: ServiceDep):
    """Notificación de Mercado Pago (ADR-0022).

    1. Sólo interesa el tópico `payment`; el resto se contesta 200 y se ignora.
    2. Se valida `x-signature` (HMAC-SHA256 con la clave secreta del webhook
       sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`). Firma mala →
       401 (no se lee nada más).
    3. El caso de uso lee el pago de la API de Mercado Pago y recién ahí
       decide; el cuerpo de la notificación nunca alcanza para activar.
    Si Mercado Pago no responde, 502: Mercado Pago reintenta solo.
    """
    if not service.billing_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    params = request.query_params
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    topic = params.get("type") or params.get("topic") or body.get("type") or ""
    data_id = params.get("data.id") or params.get("id") or str(data.get("id") or "")
    if topic != "payment" or not data_id:
        return WebhookAck(result="ignorado")
    if not verify_signature(
        secret=app_settings.mercadopago_webhook_secret,
        x_signature=request.headers.get("x-signature"),
        request_id=request.headers.get("x-request-id"),
        data_id=params.get("data.id") or data_id,
    ):
        logger.warning("subscription.webhook.bad_signature")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma inválida")
    try:
        outcome = await service.handle_payment_notification(data_id)
    except BillingGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    logger.info("subscription.webhook", extra={"result": outcome.result})
    return WebhookAck(result=outcome.result)
