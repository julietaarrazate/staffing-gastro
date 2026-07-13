"""Esquemas HTTP (Pydantic) del módulo subscription."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SubscriptionResponse(BaseModel):
    """`GET /subscription` — suscripción del comercio logueado."""

    plan_code: str
    status: str
    period_end: datetime
    price_ars: Decimal
    max_turnos_mes: int | None
    turnos_usados_mes: int


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
