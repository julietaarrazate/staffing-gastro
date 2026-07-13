"""Excepciones del dominio de suscripción (Fase 1 ADR-0005: mensualidad)."""


class SubscriptionError(Exception):
    """Excepción base del módulo subscription."""


class UnknownPlanError(SubscriptionError):
    """El código de plan pedido no existe en la configuración (`plans.PLANS`)."""

    def __init__(self, plan_code: str) -> None:
        self.plan_code = plan_code
        super().__init__(f"El plan '{plan_code}' no existe")


class PlanLimitExceededError(SubscriptionError):
    """El comercio ya alcanzó el tope de turnos publicables de su plan en el
    período actual — la palanca de valor del abono (ver ADR-0005)."""

    def __init__(self, max_turnos_mes: int) -> None:
        self.max_turnos_mes = max_turnos_mes
        super().__init__(
            f"Alcanzaste el límite de turnos de tu plan ({max_turnos_mes}/mes). "
            "Mejorá tu plan para publicar más."
        )
