"""Política de entrega del push: tipo de aviso -> vigencia (TTL) y urgencia.

Un único lugar para decidir cuánto vale un aviso. La vigencia es el tiempo que
el servicio push (FCM, Mozilla, Apple) guarda el aviso si el celular no está
conectado en el momento del envío; la urgencia (RFC 8030, cabecera `Urgency`)
le dice si despertar al dispositivo aunque esté en ahorro de batería. Sin
vigencia (TTL 0) el aviso se descarta al instante y la persona nunca se entera.

Dominio puro: no conoce la librería de push; el adaptador traduce esto a
`ttl` y cabecera `Urgency`.

Criterio (decisión de producto):
- Turno nuevo o urgente cerca: 30 min, urgencia alta. Pasada media hora lo más
  probable es que ya esté cubierto: no tiene que llegar un aviso viejo.
- Lo que pide actuar sobre un turno o avisa de un cambio en un turno propio:
  12 h, urgencia alta.
- Avisos que solo valen en el momento (recordatorios de llegada y de salida,
  «va en camino»): 30 min, urgencia alta. Dicen una hora sin fecha o una
  distancia al salir: llegar horas tarde afirmaría algo que ya no es cierto
  (y la ubicación no debe quedar guardada de más en el servicio push).
- Todo lo demás (pagos, reseñas, verificación, soporte, plan): 24 h, normal.

Un `NotificationType` nuevo tiene que quedar en `_RULES` o en
`DEFAULT_POLICY_TYPES`: un test recorre el enum y falla si falta.
"""

from dataclasses import dataclass
from enum import Enum

from app.modules.notification.domain.value_objects import NotificationType


class PushUrgency(str, Enum):
    """Valores de la cabecera `Urgency` (RFC 8030 §5.3)."""

    VERY_LOW = "very-low"
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


@dataclass(frozen=True)
class PushPolicy:
    ttl_seconds: int
    urgency: PushUrgency


_MINUTE = 60
_HOUR = 3600

DEFAULT_PUSH_POLICY = PushPolicy(ttl_seconds=24 * _HOUR, urgency=PushUrgency.NORMAL)

_TURNO_CERCA = PushPolicy(ttl_seconds=30 * _MINUTE, urgency=PushUrgency.HIGH)
_ACCION_SOBRE_TURNO = PushPolicy(ttl_seconds=12 * _HOUR, urgency=PushUrgency.HIGH)

_AVISO_DEL_MOMENTO = PushPolicy(ttl_seconds=30 * _MINUTE, urgency=PushUrgency.HIGH)

_N = NotificationType

_RULES: dict[NotificationType, PushPolicy] = {
    # Turno que todavía no es de nadie: vence rápido.
    _N.NEW_SHIFT_NEARBY: _TURNO_CERCA,
    _N.URGENT_SHIFT_NEARBY: _TURNO_CERCA,
    # Piden actuar sobre un turno o avisan un cambio en un turno propio.
    _N.NEW_APPLICANT: _ACCION_SOBRE_TURNO,
    _N.SHIFT_ASSIGNED: _ACCION_SOBRE_TURNO,
    _N.SHIFT_CONFIRMED: _ACCION_SOBRE_TURNO,
    _N.SHIFT_REJECTED: _ACCION_SOBRE_TURNO,
    _N.SHIFT_CANCELLED_LATE: _ACCION_SOBRE_TURNO,
    _N.SHIFT_CANCELLED: _ACCION_SOBRE_TURNO,
    _N.APPLIED_SHIFT_CANCELLED: _ACCION_SOBRE_TURNO,
    _N.SHIFT_NO_SHOW: _ACCION_SOBRE_TURNO,
    _N.SHIFT_CHECKED_OUT: _ACCION_SOBRE_TURNO,
    _N.SHIFT_REOPENED: _ACCION_SOBRE_TURNO,
    _N.SHIFT_NOT_COVERED: _ACCION_SOBRE_TURNO,
    _N.CHAT_MESSAGE: _ACCION_SOBRE_TURNO,
    # Solo valen en el momento: pasada media hora el texto ya no es cierto.
    _N.WORKER_EN_ROUTE: _AVISO_DEL_MOMENTO,
    _N.CHECKIN_REMINDER: _AVISO_DEL_MOMENTO,
    _N.DEPARTURE_REMINDER: _AVISO_DEL_MOMENTO,
}

# Caen en `DEFAULT_PUSH_POLICY` a propósito (pagos, reseñas, verificación,
# soporte, plan). Anotar acá un tipo nuevo es la decisión explícita.
DEFAULT_POLICY_TYPES: frozenset[NotificationType] = frozenset(
    {
        _N.SHIFT_PAID,
        _N.REVIEW_RECEIVED,
        _N.VERIFICATION_DECIDED,
        _N.SUPPORT_REPLY,
        _N.SUBSCRIPTION_PAID,
        _N.SUBSCRIPTION_EXPIRING,
        _N.SUBSCRIPTION_EXPIRED,
        _N.SUBSCRIPTION_REFUNDED,
    }
)


def push_policy_for(type_: NotificationType) -> PushPolicy:
    """Vigencia y urgencia del push de este tipo. Sin regla, el default."""
    return _RULES.get(type_, DEFAULT_PUSH_POLICY)


def types_with_explicit_rule() -> set[NotificationType]:
    return set(_RULES)
