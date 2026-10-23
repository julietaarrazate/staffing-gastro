"""`FakeBillingGateway`: doble de `BillingGateway` para tests (sin red).

Simula los dos estados del feature-flag (`enabled_`), guarda las preferencias
creadas (`created`) y los reembolsos pedidos (`refunds`), y devuelve los
pagos que el test cargue en `payments` como si vinieran de la API.
"""

from dataclasses import dataclass, field
from uuid import UUID

from app.modules.subscription.domain.billing_gateway import (
    BillingGateway,
    CheckoutResult,
    GatewayPayment,
)
from app.modules.subscription.domain.exceptions import BillingGatewayError
from app.modules.subscription.domain.plans import Plan


@dataclass
class FakeBillingGateway(BillingGateway):
    enabled_: bool = False
    created: list[tuple[UUID, Plan]] = field(default_factory=list)
    payments: dict[str, GatewayPayment] = field(default_factory=dict)
    refunds: list[str] = field(default_factory=list)
    fail_refunds: bool = False

    @property
    def enabled(self) -> bool:
        return self.enabled_

    async def create_checkout(
        self, *, intent_id: UUID, plan: Plan, payer_email: str
    ) -> CheckoutResult:
        self.created.append((intent_id, plan))
        return CheckoutResult(
            checkout_url=f"https://fake-mp.test/checkout/{intent_id}",
            preference_id=f"pref-{intent_id}",
        )

    async def get_payment(self, payment_id: str) -> GatewayPayment | None:
        return self.payments.get(payment_id)

    async def refund_payment(self, payment_id: str, *, idempotency_key: str) -> None:
        if self.fail_refunds:
            raise BillingGatewayError("refund falló")
        self.refunds.append(payment_id)
