"""Puerto de envío de Web Push (degradación elegante).

Mismo contrato que `EmailSender`: ninguna implementación debe dejar que un
fallo de envío (proveedor caído, endpoint dado de baja, claves VAPID
ausentes) se propague como excepción no controlada — el envío de push es
best-effort y jamás debe romper el flujo de negocio que crea la notificación
in-app (ver hook en `infrastructure/repositories.py::SqlAlchemyNotificationRepository.add`).
"""

from abc import ABC, abstractmethod
from enum import Enum

from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.domain.push_policy import DEFAULT_PUSH_POLICY, PushPolicy


class PushSendResult(str, Enum):
    SENT = "sent"
    # Fallo transitorio (proveedor caído, VAPID sin configurar, timeout): la
    # suscripción sigue siendo válida, no se purga.
    FAILED = "failed"
    # El proveedor push respondió 404/410: el endpoint ya no existe (el
    # usuario desinstaló la PWA, revocó el permiso, o cambió de navegador).
    # El llamador debe purgar la suscripción.
    GONE = "gone"


class PushSender(ABC):
    """Puerto de envío de Web Push. Cero import de infraestructura ni de proveedor."""

    @abstractmethod
    async def send(
        self,
        subscription: PushSubscription,
        *,
        title: str,
        body: str,
        url: str = "/",
        policy: PushPolicy = DEFAULT_PUSH_POLICY,
    ) -> PushSendResult:
        """Envía una notificación push a una suscripción puntual, con la
        vigencia y la urgencia de `policy` (ver `push_policy.py`).

        Nunca lanza: cualquier error del proveedor se atrapa y se traduce a
        `PushSendResult.FAILED` (o `GONE` si es un 404/410)."""
