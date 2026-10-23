"""Entidades de dominio: `Subscription` y `SubscriptionPayment`.

Suscripción del comercio al plan de Oído — Fase 1 del ADR-0005 (mensualidad
escalonada, NO split de pago de turno) con el cobro del ADR-0021: un pago por
mes con Checkout Pro de Mercado Pago, sin débito automático.

Dos relojes distintos en la misma suscripción:

- `period_start`/`period_end`: la **ventana de uso** del contador
  `turnos_usados_mes` (30 días que ruedan solos al publicar). Existe desde
  ADR-0005 y no cambia.
- `paid_until`: hasta cuándo está **pago** el plan. Sólo cuenta con el cobro
  real exigido (`settings.billing_enforced`); con el cobro apagado queda en
  `None` y nadie lo mira.

Se separan para que pagar antes de tiempo no estire la ventana del contador
(un comercio que renueva el día 25 no tiene que esperar 35 días para que se
le reinicien los turnos).
"""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from app.core.dt import naive as _naive
from app.core.tz import to_art
from app.modules.subscription.domain.exceptions import (
    NothingToCancelError,
    PlanLimitExceededError,
    SubscriptionNotActiveError,
)
from app.modules.subscription.domain.plans import Plan
from app.modules.subscription.domain.value_objects import (
    ExpiryNotice,
    PaymentStatus,
    SubscriptionStatus,
)

# Un mes pago = 30 días fijos (ADR-0021), igual que la ventana de uso: evita
# los bordes de meses de distinta longitud.
PERIOD_LENGTH = timedelta(days=30)

# Gracia después de `paid_until`: se puede seguir publicando 3 días más y
# recién ahí la suscripción pasa a `vencida` (ADR-0021).
GRACE_PERIOD = timedelta(days=3)

# El primer aviso sale 3 días antes de `paid_until`.
REMINDER_LEAD = timedelta(days=3)

# Arrepentimiento (Ley 24.240, art. 34): 10 días corridos desde el primer pago.
WITHDRAWAL_DAYS = 10


def withdrawal_deadline(first_paid_at: datetime) -> date:
    """Último día (hora argentina) para arrepentirse del primer mes pago."""
    return to_art(first_paid_at).date() + timedelta(days=WITHDRAWAL_DAYS)


@dataclass
class Subscription:
    """Raíz de agregado Subscription (1:1 con `Company`)."""

    company_id: UUID
    plan_code: str
    status: SubscriptionStatus
    period_start: datetime
    period_end: datetime
    turnos_usados_mes: int = 0
    paid_until: datetime | None = None
    # False = dio de baja: no se le recuerda pagar y al final del período
    # pago queda `cancelada` en vez de `vencida`.
    renews: bool = True
    expiry_notice: ExpiryNotice | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # --- Ventana de uso (ADR-0005) ---------------------------------------

    def roll_period_if_expired(self, now: datetime) -> None:
        """Si la ventana de uso ya venció, abre una nueva y resetea el
        contador de turnos publicados. No toca `plan_code`, `status` ni
        `paid_until`: el cobro tiene su propio reloj."""
        if _naive(now) >= _naive(self.period_end):
            self.period_start = now
            self.period_end = now + PERIOD_LENGTH
            self.turnos_usados_mes = 0

    def ensure_can_publish(self, plan: Plan) -> None:
        """Levanta `PlanLimitExceededError` si el plan tiene tope de turnos y
        ya se alcanzó en el período actual. Un plan ilimitado
        (`max_turnos_mes is None`, p. ej. `pro`) nunca bloquea."""
        if plan.max_turnos_mes is not None and self.turnos_usados_mes >= plan.max_turnos_mes:
            raise PlanLimitExceededError(plan.max_turnos_mes)

    def register_publication(self) -> None:
        """Registra un turno publicado en el período actual (después de
        `ensure_can_publish`)."""
        self.turnos_usados_mes += 1

    def change_plan(self, plan_code: str, *, now: datetime | None = None) -> None:
        """Cambio de plan inmediato, sin cobro (sólo con el cobro apagado):
        abre una ventana de uso nueva y resetea el contador."""
        now = now or datetime.now(UTC)
        self.plan_code = plan_code
        self.status = SubscriptionStatus.ACTIVA
        self.period_start = now
        self.period_end = now + PERIOD_LENGTH
        self.turnos_usados_mes = 0

    # --- Cobro (ADR-0021) -------------------------------------------------

    def is_paid(self, now: datetime) -> bool:
        """Mes pago vigente, contando los días de gracia."""
        return (
            self.status == SubscriptionStatus.ACTIVA
            and self.paid_until is not None
            and _naive(now) < _naive(self.paid_until) + GRACE_PERIOD
        )

    def ensure_paid(self, now: datetime) -> None:
        """Con el cobro exigido, publicar pide un mes pago vigente."""
        if not self.is_paid(now):
            raise SubscriptionNotActiveError()

    def apply_payment(self, plan_code: str, now: datetime) -> None:
        """Acredita un mes pago de `plan_code`.

        - Si el mes anterior sigue vigente (incluida la gracia), el nuevo se
          suma desde `paid_until`: pagar antes no hace perder días.
        - Si no (nunca pagó, venció, se arrepintió), arranca hoy.
        - Si cambia de plan o vuelve de un estado inactivo, la ventana de
          uso arranca de cero con el plan nuevo; renovar el mismo plan no la
          toca (sigue rodando sola).
        """
        was_paid = self.is_paid(now)
        base = self.paid_until if (was_paid and self.paid_until is not None) else now
        if plan_code != self.plan_code or not was_paid:
            self.plan_code = plan_code
            self.period_start = now
            self.period_end = now + PERIOD_LENGTH
            self.turnos_usados_mes = 0
        self.paid_until = base + PERIOD_LENGTH
        self.status = SubscriptionStatus.ACTIVA
        self.renews = True
        self.expiry_notice = None

    def cancel_renewal(self, now: datetime) -> None:
        """Dar de baja: como el pago es manual no hay débito que cortar;
        deja de recordarle que pague y el plan sigue hasta `paid_until`."""
        if not self.is_paid(now):
            raise NothingToCancelError()
        self.renews = False

    def withdraw(self, now: datetime) -> None:
        """Arrepentimiento: el plan se corta ya (el reembolso lo hace el caso
        de uso contra Mercado Pago)."""
        self.status = SubscriptionStatus.CANCELADA
        self.paid_until = now
        self.renews = False
        self.expiry_notice = None

    def expire(self) -> None:
        """Fin del período pago + gracia: `cancelada` si había dado de baja,
        `vencida` si no."""
        self.status = SubscriptionStatus.VENCIDA if self.renews else SubscriptionStatus.CANCELADA


@dataclass
class SubscriptionPayment:
    """Un intento de pago mensual. Su `id` viaja como `external_reference`
    de la preferencia de Checkout Pro, así el webhook sabe qué plan y qué
    monto esperaba (ADR-0021)."""

    company_id: UUID
    plan_code: str
    amount_ars: Decimal
    currency: str = "ARS"
    status: PaymentStatus = PaymentStatus.PENDIENTE
    mp_payment_id: str | None = None
    mp_preference_id: str | None = None
    approved_at: datetime | None = None
    refunded_at: datetime | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None

    def matches(self, amount: Decimal, currency: str) -> bool:
        """El pago que informa Mercado Pago es por el monto y la moneda que
        se pidió. Si no coincide, no se activa nada."""
        return amount == self.amount_ars and currency == self.currency
