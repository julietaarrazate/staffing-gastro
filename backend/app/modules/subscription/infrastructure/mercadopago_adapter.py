"""`MercadoPagoCheckoutAdapter`: un pago por mes con Checkout Pro (ADR-0021).

Sin débito automático (preapproval) a propósito: cada mes el comercio paga un
link de Checkout Pro (en compu muestra un QR, en el celular abre la app de
Mercado Pago). Se excluye la tarjeta de crédito para que la comisión quede
baja. Endpoints (API de Mercado Pago, ver las referencias en ADR-0021):

- `POST /checkout/preferences` → `init_point`.
- `GET /v1/payments/{id}` → estado, monto, moneda, `external_reference`.
- `POST /v1/payments/{id}/refunds` → reembolso total (arrepentimiento).

Detrás del feature-flag `settings.billing_enabled` (access token + clave del
webhook). Cero import de la capa de aplicación de otro módulo.
"""

import logging
from datetime import datetime
from decimal import Decimal
from uuid import UUID

import httpx

from app.core.config import Settings
from app.core.dt import parse_iso_datetime
from app.modules.subscription.domain.billing_gateway import (
    BillingGateway,
    CheckoutResult,
    GatewayPayment,
)
from app.modules.subscription.domain.exceptions import BillingGatewayError
from app.modules.subscription.domain.plans import Plan

logger = logging.getLogger(__name__)

WEBHOOK_PATH = "/api/v1/subscription/webhooks/mercadopago"


def build_preference_payload(
    settings: Settings, *, intent_id: UUID, plan: Plan, payer_email: str
) -> dict:
    """Cuerpo de la preferencia. Público para testearlo sin red."""
    front = settings.frontend_url.rstrip("/")
    return {
        "items": [
            {
                "id": plan.code,
                "title": f"Oído · plan {plan.name} (30 días)",
                "quantity": 1,
                "unit_price": float(plan.price_ars),
                "currency_id": "ARS",
            }
        ],
        "payer": {"email": payer_email},
        "external_reference": str(intent_id),
        "back_urls": {
            "success": f"{front}/subscription?pago=ok",
            "pending": f"{front}/subscription?pago=pendiente",
            "failure": f"{front}/subscription?pago=error",
        },
        "auto_return": "approved",
        "notification_url": f"{settings.api_public_url.rstrip('/')}{WEBHOOK_PATH}",
        # Sin tarjeta de crédito: es la que más comisión cobra. Quedan dinero
        # en cuenta, débito y lo que Mercado Pago ofrezca además (ADR-0021).
        "payment_methods": {
            "excluded_payment_types": [{"id": "credit_card"}],
            "installments": 1,
        },
        "statement_descriptor": "OIDO",
    }


class MercadoPagoCheckoutAdapter(BillingGateway):
    """Adaptador real contra la API de Mercado Pago."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        return self._settings.billing_enabled

    def _client(self) -> httpx.AsyncClient:
        if not self.enabled:
            raise RuntimeError(
                "MercadoPagoCheckoutAdapter sin credenciales: el cobro real está "
                "apagado (faltan MERCADOPAGO_ACCESS_TOKEN / MERCADOPAGO_WEBHOOK_SECRET)."
            )
        return httpx.AsyncClient(
            base_url=self._settings.mercadopago_base_url,
            timeout=15.0,
            headers={"Authorization": f"Bearer {self._settings.mercadopago_access_token}"},
        )

    async def create_checkout(
        self, *, intent_id: UUID, plan: Plan, payer_email: str
    ) -> CheckoutResult:
        payload = build_preference_payload(
            self._settings, intent_id=intent_id, plan=plan, payer_email=payer_email
        )
        try:
            async with self._client() as client:
                response = await client.post(
                    "/checkout/preferences",
                    json=payload,
                    headers={"X-Idempotency-Key": str(intent_id)},
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.warning("mercadopago.preference_failed", extra={"error": str(exc)})
            raise BillingGatewayError(str(exc)) from exc
        return CheckoutResult(checkout_url=data["init_point"], preference_id=str(data["id"]))

    async def get_payment(self, payment_id: str) -> GatewayPayment | None:
        try:
            async with self._client() as client:
                response = await client.get(f"/v1/payments/{payment_id}")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.warning("mercadopago.payment_read_failed", extra={"error": str(exc)})
            raise BillingGatewayError(str(exc)) from exc
        approved_at: datetime | None = parse_iso_datetime(data.get("date_approved"))
        return GatewayPayment(
            id=str(data["id"]),
            status=str(data.get("status", "")),
            amount=Decimal(str(data.get("transaction_amount", "0"))),
            currency=str(data.get("currency_id", "")),
            external_reference=data.get("external_reference"),
            approved_at=approved_at,
        )

    async def refund_payment(self, payment_id: str, *, idempotency_key: str) -> None:
        try:
            async with self._client() as client:
                response = await client.post(
                    f"/v1/payments/{payment_id}/refunds",
                    json={},
                    headers={"X-Idempotency-Key": idempotency_key},
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("mercadopago.refund_failed", extra={"error": str(exc)})
            raise BillingGatewayError(str(exc)) from exc
