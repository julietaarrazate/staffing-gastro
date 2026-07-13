"""`FakeBillingGateway`: doble de `BillingGateway` para tests.

No llama a Mercado Pago; simula ambos estados del feature-flag (`enabled`
fijo por instancia) y registra los llamados a `create_preapproval` (`created`)
para asserts, sin acoplar los tests a la infraestructura real.
"""

from dataclasses import dataclass, field
from uuid import UUID

from app.modules.subscription.domain.billing_gateway import (
    BillingGateway,
    PreapprovalResult,
)
from app.modules.subscription.domain.plans import Plan


@dataclass
class FakeBillingGateway(BillingGateway):
    enabled_: bool = False
    created: list[tuple[UUID, Plan]] = field(default_factory=list)

    @property
    def enabled(self) -> bool:
        return self.enabled_

    async def create_preapproval(
        self, *, company_id: UUID, payer_email: str, plan: Plan
    ) -> PreapprovalResult:
        self.created.append((company_id, plan))
        return PreapprovalResult(
            checkout_url=f"https://fake-mp.test/checkout/{company_id}",
            external_reference=str(company_id),
        )
