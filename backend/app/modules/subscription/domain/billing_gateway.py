"""Puerto de cobro recurrente (Fase 1 ADR-0005: mensualidad, NO split).

`BillingGateway.enabled` es el feature-flag: sin credenciales de Mercado Pago
configuradas (`app.core.config.Settings.mercadopago_access_token` vacío), la
implementación real reporta `enabled=False` y el sistema opera sin cobro (el
plan se puede setear igual, ver `SubscriptionService.subscribe`). Mismo
patrón que `sentry_dsn`/observability: cada integración es un flag.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.modules.subscription.domain.plans import Plan


@dataclass(frozen=True)
class PreapprovalResult:
    """Resultado de iniciar un cobro recurrente (preapproval) en el gateway."""

    checkout_url: str
    external_reference: str


class BillingGateway(ABC):
    """Puerto de cobro recurrente simple (preapproval de suscripción), NO
    split/`application_fee` — eso es Fase 2 (ver ADR-0005), fuera de alcance
    acá. Cero import de la capa de aplicación de otro módulo."""

    @property
    @abstractmethod
    def enabled(self) -> bool:
        """True si hay credenciales configuradas y el cobro real está activo."""

    @abstractmethod
    async def create_preapproval(
        self, *, company_id: UUID, payer_email: str, plan: Plan
    ) -> PreapprovalResult:
        """Crea la suscripción recurrente (preapproval) en el gateway y
        devuelve la URL de checkout para que el comercio complete el alta.
        No debe invocarse si `enabled` es False."""
