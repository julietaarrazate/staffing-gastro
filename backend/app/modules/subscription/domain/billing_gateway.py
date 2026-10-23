"""Puerto de cobro mensual (ADR-0021: un pago por mes, sin débito automático).

`BillingGateway.enabled` es el feature-flag: sin las credenciales de Mercado
Pago (`MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`) la
implementación real reporta `enabled=False` y el sistema opera sin cobro
(el plan se puede setear igual, ver `SubscriptionService.subscribe`).
Mismo patrón que `sentry_dsn`: cada integración es un flag.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.modules.subscription.domain.plans import Plan

# Estado de un pago aprobado en Mercado Pago (`status` de `/v1/payments/{id}`).
APPROVED = "approved"


@dataclass(frozen=True)
class CheckoutResult:
    """La preferencia creada: el link al que se manda al comercio
    (`init_point`; en compu muestra un QR, en el celular abre la app de MP)."""

    checkout_url: str
    preference_id: str


@dataclass(frozen=True)
class GatewayPayment:
    """Lo que interesa de un pago leído de la API del gateway."""

    id: str
    status: str
    amount: Decimal
    currency: str
    external_reference: str | None
    approved_at: datetime | None


class BillingGateway(ABC):
    """Puerto de cobro de un pago por mes (Checkout Pro), NO split ni
    `application_fee` (eso es Fase 2 de ADR-0005)."""

    @property
    @abstractmethod
    def enabled(self) -> bool:
        """True si hay credenciales configuradas y el cobro real está activo."""

    @abstractmethod
    async def create_checkout(
        self, *, intent_id: UUID, plan: Plan, payer_email: str
    ) -> CheckoutResult:
        """Crea la preferencia de pago de un mes de `plan`, con
        `external_reference = intent_id`. Sólo con `enabled`."""

    @abstractmethod
    async def get_payment(self, payment_id: str) -> GatewayPayment | None:
        """Lee un pago por su id. `None` si el gateway no lo conoce."""

    @abstractmethod
    async def refund_payment(self, payment_id: str, *, idempotency_key: str) -> None:
        """Reembolso total del pago (arrepentimiento)."""
