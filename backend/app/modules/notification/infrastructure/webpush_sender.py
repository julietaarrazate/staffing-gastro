"""`WebPushSender`: adaptador real de Web Push (RFC 8030) vía `pywebpush`.

`pywebpush.webpush` es una llamada de red **síncrona** (usa `requests` por
debajo); se corre en threadpool (`asyncio.to_thread`) para no bloquear el
loop async del proceso — mismo motivo que cualquier adaptador infra que
envuelve una librería síncrona en este proyecto.
"""

import asyncio
import json
import logging

from app.core.config import Settings
from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.domain.push_sender import PushSendResult, PushSender

logger = logging.getLogger(__name__)


class WebPushSender(PushSender):
    """Adaptador real: envía la notificación al servicio push del navegador
    (Chrome/Firefox/Edge) cifrada con las claves de la suscripción, firmada
    con las claves VAPID del servidor."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send(
        self, subscription: PushSubscription, *, title: str, body: str, url: str = "/"
    ) -> PushSendResult:
        try:
            return await asyncio.to_thread(self._send_sync, subscription, title, body, url)
        except Exception:
            # Defensa en profundidad: aunque `_send_sync` ya atrapa sus
            # propios errores, un fallo inesperado acá tampoco debe
            # propagarse (contrato del puerto: nunca lanza).
            logger.exception(
                "WebPushSender: fallo inesperado enviando push (user_id=%s)",
                subscription.user_id,
            )
            return PushSendResult.FAILED

    def _send_sync(
        self, subscription: PushSubscription, title: str, body: str, url: str
    ) -> PushSendResult:
        from pywebpush import WebPushException, webpush

        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh_key,
                        "auth": subscription.auth_key,
                    },
                },
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=self._settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{self._settings.vapid_contact_email}"},
            )
            return PushSendResult.SENT
        except WebPushException as exc:
            status_code = getattr(exc.response, "status_code", None)
            if status_code in (404, 410):
                logger.info(
                    "WebPushSender: endpoint dado de baja (status=%s, user_id=%s)",
                    status_code,
                    subscription.user_id,
                )
                return PushSendResult.GONE
            logger.warning(
                "WebPushSender: fallo del proveedor (status=%s, user_id=%s): %s",
                status_code,
                subscription.user_id,
                exc,
            )
            return PushSendResult.FAILED
