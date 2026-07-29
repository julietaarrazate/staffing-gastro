"""`MercadoPagoSuscripcionAdapter`: cobro recurrente simple (preapproval).

Fase 1 del ADR-0005 — es un preapproval de suscripción estándar de MP, NO
split/marketplace (eso es Fase 2, fuera de alcance). Detrás de un
feature-flag: sin `mercadopago_access_token` configurado, `enabled` es False
y el sistema no intenta cobrar (mismo patrón que `sentry_dsn`, ver
`app.core.config.Settings`). Cero import de la capa de aplicación de otro
módulo — sólo `app.core.config.Settings` (core, no un módulo de dominio).
"""

import httpx

from app.core.config import Settings
from app.modules.subscription.domain.billing_gateway import (
    BillingGateway,
    PreapprovalResult,
)
from app.modules.subscription.domain.plans import Plan


class MercadoPagoSuscripcionAdapter(BillingGateway):
    """Adaptador real contra la API de Mercado Pago (`/preapproval`)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        return bool(self._settings.mercadopago_access_token)

    async def create_preapproval(
        self, *, company_id, payer_email: str, plan: Plan
    ) -> PreapprovalResult:
        if not self.enabled:
            raise RuntimeError(
                "MercadoPagoSuscripcionAdapter sin credenciales: la feature de "
                "cobro real está apagada (falta MERCADOPAGO_ACCESS_TOKEN)."
            )
        payload = {
            "reason": f"Oído — plan {plan.name}",
            "external_reference": str(company_id),
            "payer_email": payer_email,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": float(plan.price_ars),
                "currency_id": "ARS",
            },
            "back_url": "https://staffya.com/subscription",
            "status": "pending",
        }
        async with httpx.AsyncClient(
            base_url=self._settings.mercadopago_base_url, timeout=15.0
        ) as client:
            response = await client.post(
                "/preapproval",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._settings.mercadopago_access_token}"
                },
            )
            response.raise_for_status()
            data = response.json()
        return PreapprovalResult(
            checkout_url=data["init_point"],
            external_reference=str(data.get("id", "")),
        )
