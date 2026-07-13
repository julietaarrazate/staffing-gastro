"""Entidad de dominio Subscription.

Suscripción del comercio al plan de Staffya — Fase 1 del ADR-0005
(mensualidad escalonada, NO split de pago de turno). El plan gatea la
capacidad de publicación de turnos; ver `ensure_can_publish`/
`register_publication`, consumidas desde `shift` vía el puerto de dominio
(`domain/repositories.py::SubscriptionRepository`).
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.modules.subscription.domain.exceptions import PlanLimitExceededError
from app.modules.subscription.domain.plans import Plan
from app.modules.subscription.domain.value_objects import SubscriptionStatus

# Duración del período de uso (ventana del contador `turnos_usados_mes`).
# Simplificación deliberada: 30 días fijos en vez de "mes calendario" (evita
# los bordes de meses de distinta longitud). Ver TECH_DEBT si se necesita
# alinear a mes calendario real.
PERIOD_LENGTH = timedelta(days=30)


def _naive(dt: datetime) -> datetime:
    """Normaliza a "naive" antes de comparar: en SQLite (tests) los datetimes
    vuelven sin tzinfo; en Postgres las columnas `TIMESTAMPTZ` sí lo
    preservan. Mismo fix que `ShiftService._was_punctual`. Se asume que
    ambos valores están en UTC."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


@dataclass
class Subscription:
    """Raíz de agregado Subscription (1:1 con `Company`)."""

    company_id: UUID
    plan_code: str
    status: SubscriptionStatus
    period_start: datetime
    period_end: datetime
    turnos_usados_mes: int = 0

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def roll_period_if_expired(self, now: datetime) -> None:
        """Si el período de uso ya venció, abre uno nuevo y resetea el
        contador de turnos publicados.

        No toca `plan_code` ni `status`: en esta fase (sin cobro real o con
        el flag apagado) no hay señal de pago que marque `vencida` — el
        gating acá es de **capacidad**, no de cobro (ver ADR-0005 Fase 1).
        """
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
        """Registra un turno publicado en el período actual.

        Asume que `ensure_can_publish` ya se llamó antes: no repite el
        chequeo (mismo patrón que `Shift._transition`, que separa la
        validación de la mutación)."""
        self.turnos_usados_mes += 1

    def change_plan(self, plan_code: str, *, now: datetime | None = None) -> None:
        """Cambia de plan (alta o upgrade/downgrade): abre un período nuevo y
        resetea el contador de uso, el comercio arranca limpio en el plan
        nuevo. Usado por `subscribe` con el feature-flag de cobro apagado
        (sin flag, cambiar de plan es inmediato, no espera confirmación de
        pago — ver ADR-0005 Fase 1)."""
        now = now or datetime.now(timezone.utc)
        self.plan_code = plan_code
        self.status = SubscriptionStatus.ACTIVA
        self.period_start = now
        self.period_end = now + PERIOD_LENGTH
        self.turnos_usados_mes = 0
