"""Configuración de planes de suscripción (Fase 1 ADR-0005).

Los planes son **datos de configuración**, no lógica de negocio: la entidad
`Subscription` y el gating de capacidad (consumido desde `shift`) sólo
conocen un `Plan` (código, tope de turnos, precio) resuelto acá, nunca un
número hardcodeado en medio de una regla. Ajustar montos/topes es editar este
diccionario — no toca el dominio ni el caso de uso.

Valores semilla del ADR-0005, sin el plan gratis desde el ADR-0020 (a
calibrar en la beta, ver docs/adr/).
"""

from dataclasses import dataclass, field
from decimal import Decimal

from app.modules.subscription.domain.exceptions import UnknownPlanError


@dataclass(frozen=True)
class Plan:
    """Un escalón de la mensualidad."""

    code: str
    name: str
    price_ars: Decimal
    max_turnos_mes: int | None  # None = ilimitado
    features: tuple[str, ...] = field(default_factory=tuple)


PLANS: dict[str, Plan] = {
    # Sin plan gratis desde ADR-0020 (2026-10-22): un escalón de entrada pago
    # filtra a quien entra sólo a mirar o copiar, y el que es comercio de
    # verdad igual lo paga.
    "inicial": Plan(
        code="inicial",
        name="Inicial",
        price_ars=Decimal("9900"),
        max_turnos_mes=5,
        features=("Hasta 5 turnos publicados por mes", "Soporte por email"),
    ),
    "basico": Plan(
        code="basico",
        name="Básico",
        price_ars=Decimal("20000"),
        max_turnos_mes=15,
        features=("Hasta 15 turnos publicados por mes", "Soporte prioritario"),
    ),
    "pro": Plan(
        code="pro",
        name="Pro",
        price_ars=Decimal("45000"),
        max_turnos_mes=None,
        features=(
            "Turnos publicados ilimitados",
            "Soporte prioritario",
            "Destacado en el feed",
        ),
    ),
}

# Cada comercio nuevo arranca acá (ver `SubscriptionRepository.get_or_create`).
DEFAULT_PLAN_CODE = "inicial"


def get_plan(plan_code: str) -> Plan:
    """Busca un plan por código. Levanta `UnknownPlanError` si no existe."""
    plan = PLANS.get(plan_code)
    if plan is None:
        raise UnknownPlanError(plan_code)
    return plan


def list_plans() -> list[Plan]:
    """Planes en orden ascendente de precio, para mostrar en la UI."""
    return sorted(PLANS.values(), key=lambda p: p.price_ars)
