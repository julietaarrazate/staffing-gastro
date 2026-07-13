"""Casos de uso del módulo subscription (Fase 1 ADR-0005: mensualidad)."""

from dataclasses import dataclass
from uuid import UUID

from app.modules.subscription.domain.billing_gateway import BillingGateway
from app.modules.subscription.domain.entities import Subscription
from app.modules.subscription.domain.plans import Plan, get_plan, list_plans
from app.modules.subscription.domain.repositories import SubscriptionRepository


@dataclass
class SubscribeResult:
    """Resultado de `POST /subscription/subscribe`.

    Se modela aparte de `Subscription`: con el feature-flag de cobro
    encendido, `status` acá es el transitorio **"pendiente"** del checkout de
    MP, que no es un valor del enum `SubscriptionStatus` persistido
    (activa/vencida/cancelada) — la suscripción real recién pasa a `activa`
    cuando confirme el pago (webhook, fuera de alcance de esta fase).
    """

    plan_code: str
    status: str
    checkout_url: str | None


class SubscriptionService:
    """Servicio de aplicación para gestionar la suscripción del comercio."""

    def __init__(
        self, subscriptions: SubscriptionRepository, billing: BillingGateway
    ) -> None:
        self._subscriptions = subscriptions
        self._billing = billing

    async def get_my_subscription(self, company_id: UUID) -> Subscription:
        return await self._subscriptions.get_or_create(company_id)

    @staticmethod
    def list_plans() -> list[Plan]:
        return list_plans()

    async def subscribe(
        self, company_id: UUID, plan_code: str, *, payer_email: str
    ) -> SubscribeResult:
        """Suscribe al comercio a un plan.

        - Flag ON (hay credenciales de MP): crea el preapproval y devuelve
          `status="pendiente"` + `checkout_url` — el plan real se activa
          cuando confirme el pago (fuera de alcance acá).
        - Flag OFF: setea el plan ya mismo (`status activa`, período nuevo,
          contador de uso en cero) y `checkout_url=None`.
        """
        plan = get_plan(plan_code)  # UnknownPlanError si no existe

        if self._billing.enabled:
            result = await self._billing.create_preapproval(
                company_id=company_id, payer_email=payer_email, plan=plan
            )
            return SubscribeResult(
                plan_code=plan.code, status="pendiente", checkout_url=result.checkout_url
            )

        subscription = await self._subscriptions.get_or_create(company_id)
        subscription.change_plan(plan.code)
        subscription = await self._subscriptions.update(subscription)
        return SubscribeResult(
            plan_code=subscription.plan_code,
            status=subscription.status.value,
            checkout_url=None,
        )
