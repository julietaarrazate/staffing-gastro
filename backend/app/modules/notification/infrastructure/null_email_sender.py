"""`NullEmailSender`: adaptador por defecto sin credenciales de Resend.

Se inyecta cuando `settings.resend_api_key` está vacío (dev/CI/beta sin
cuenta de Resend configurada todavía). Sólo loguea el intento — nunca falla,
así el feature de email puede mergearse y desplegarse antes de tener
credenciales reales (mismo patrón que `sentry_dsn`/`mercadopago_access_token`).
"""

import logging

from app.modules.notification.domain.email_sender import EmailSender

logger = logging.getLogger(__name__)


class NullEmailSender(EmailSender):
    """No-op: registra el envío que hubiera ocurrido y listo."""

    async def send(self, to: str, subject: str, html: str) -> None:
        logger.info(
            "NullEmailSender: RESEND_API_KEY no configurada, no se envía email "
            "(to=%s, subject=%r)",
            to,
            subject,
        )
