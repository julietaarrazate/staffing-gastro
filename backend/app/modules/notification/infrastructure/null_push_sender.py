"""`NullPushSender`: adaptador por defecto sin claves VAPID configuradas.

Se inyecta cuando `settings.vapid_public_key`/`vapid_private_key` están
vacías (dev/CI/beta sin claves generadas todavía). Sólo loguea el intento —
nunca falla, así el feature de push puede mergearse y desplegarse antes de
tener las claves reales (mismo patrón que `NullEmailSender`)."""

import logging

from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.domain.push_sender import PushSendResult, PushSender

logger = logging.getLogger(__name__)


class NullPushSender(PushSender):
    async def send(
        self, subscription: PushSubscription, *, title: str, body: str, url: str = "/"
    ) -> PushSendResult:
        logger.info(
            "NullPushSender: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configuradas, "
            "no se envía push (user_id=%s, title=%r)",
            subscription.user_id,
            title,
        )
        return PushSendResult.FAILED
