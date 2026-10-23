"""Esquemas HTTP (Pydantic) del módulo subscription."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SubscriptionResponse(BaseModel):
    """`GET /subscription` — suscripción del comercio logueado."""

    plan_code: str
    # pendiente | activa | vencida | cancelada
    status: str
    period_end: datetime
    price_ars: Decimal
    max_turnos_mes: int | None
    turnos_usados_mes: int
    # Cobro real (ADR-0022). Con `billing_enabled` en false el resto de los
    # campos de cobro no aplica y la pantalla se ve como en la beta.
    billing_enabled: bool = False
    paid_until: datetime | None = None
    renews: bool = True
    can_publish: bool = True
    # Último día (hora argentina) para arrepentirse; null si ya no corresponde.
    withdrawal_until: date | None = None


class PlanResponse(BaseModel):
    code: str
    name: str
    price_ars: Decimal
    max_turnos_mes: int | None
    features: list[str]


class PlansResponse(BaseModel):
    """`GET /subscription/plans`."""

    plans: list[PlanResponse]


class SubscribeRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=40)


class SubscribeResponse(BaseModel):
    """`POST /subscription/subscribe`."""

    plan_code: str
    status: str
    checkout_url: str | None


class WebhookAck(BaseModel):
    """Respuesta al webhook de Mercado Pago (cualquier 2xx alcanza)."""

    ok: bool = True
    result: str
