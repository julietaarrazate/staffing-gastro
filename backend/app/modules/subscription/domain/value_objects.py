"""Objetos de valor del dominio de suscripción."""

from enum import Enum


class SubscriptionStatus(str, Enum):
    """Estado persistido de la suscripción del comercio.

    - `pendiente`: comercio nuevo con el cobro real exigido
      (`settings.billing_enforced`) que todavía no pagó su primer mes.
    - `activa`: con el cobro apagado, siempre; con el cobro prendido, pagó
      y `paid_until` (+ gracia) no pasó.
    - `vencida`: pasó `paid_until` + `GRACE_PERIOD` sin un pago nuevo.
    - `cancelada`: se arrepintió (reembolso) o dio de baja y llegó al final
      del período pago.
    """

    PENDIENTE = "pendiente"
    ACTIVA = "activa"
    VENCIDA = "vencida"
    CANCELADA = "cancelada"


class PaymentStatus(str, Enum):
    """Estado de un intento de pago mensual (`SubscriptionPayment`)."""

    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    REEMBOLSADO = "reembolsado"


class ExpiryNotice(str, Enum):
    """Último aviso de vencimiento mandado para el `paid_until` vigente.
    Se borra cuando entra un pago nuevo (ADR-0022)."""

    POR_VENCER = "por_vencer"
    VENCIO = "vencio"
