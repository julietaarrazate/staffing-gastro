"""Excepciones del dominio de suscripción (ADR-0005 Fase 1, ADR-0021)."""


class SubscriptionError(Exception):
    """Excepción base del módulo subscription."""


class UnknownPlanError(SubscriptionError):
    """El código de plan pedido no existe en la configuración (`plans.PLANS`)."""

    def __init__(self, plan_code: str) -> None:
        self.plan_code = plan_code
        super().__init__(f"El plan '{plan_code}' no existe")


class PublishingNotAllowedError(SubscriptionError):
    """Base de lo que impide publicar por el plan. La API de `shift` la mapea
    a 402 Payment Required."""


class PlanLimitExceededError(PublishingNotAllowedError):
    """El comercio ya alcanzó el tope de turnos publicables de su plan en el
    período actual — la palanca de valor del abono (ver ADR-0005)."""

    def __init__(self, max_turnos_mes: int) -> None:
        self.max_turnos_mes = max_turnos_mes
        super().__init__(
            f"Alcanzaste el límite de turnos de tu plan ({max_turnos_mes}/mes). "
            "Mejorá tu plan para publicar más."
        )


class SubscriptionNotActiveError(PublishingNotAllowedError):
    """Con el cobro real exigido, el comercio no tiene un mes pago vigente
    (nunca pagó, venció o se arrepintió). ADR-0021."""

    def __init__(self) -> None:
        super().__init__(
            "Tu plan no está activo. Pagá el mes desde Mi plan para volver a publicar turnos."
        )


class BillingDisabledError(SubscriptionError):
    """La acción sólo existe con el cobro real prendido (baja, arrepentimiento)."""

    def __init__(self) -> None:
        super().__init__("El cobro con Mercado Pago todavía no está activado.")


class NothingToCancelError(SubscriptionError):
    """Dar de baja sin un mes pago vigente."""

    def __init__(self) -> None:
        super().__init__("No tenés un plan pago activo para dar de baja.")


class WithdrawalNotAvailableError(SubscriptionError):
    """Arrepentimiento fuera de plazo o sin un primer pago que devolver."""

    def __init__(self) -> None:
        super().__init__(
            "El arrepentimiento es dentro de los 10 días corridos de tu primer pago. "
            "Si necesitás ayuda, escribinos a soporte."
        )


class BillingGatewayError(SubscriptionError):
    """Mercado Pago no respondió o devolvió un error."""

    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos."
        )
        self.detail = detail
