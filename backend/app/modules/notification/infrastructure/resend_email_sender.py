"""`ResendEmailSender`: adaptador real contra la API HTTPS de Resend.

Llamada HTTP directa (`POST /emails`) con `httpx` — sin SDK de Resend, para no
sumar una dependencia nueva sólo por un único endpoint simple. Activo sólo si
`settings.resend_api_key` está configurado (ver `NullEmailSender` y
`app/modules/notification/api/dependencies.py::get_email_sender`).

Cero import de la capa de aplicación de otro módulo — sólo `app.core.config`
(mismo criterio que `MercadoPagoSuscripcionAdapter`).
"""

import logging

import httpx

from app.core.config import Settings
from app.modules.notification.domain.email_sender import EmailSender

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"


class ResendEmailSender(EmailSender):
    """Adaptador real: envía el email vía la API de Resend."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send(self, to: str, subject: str, html: str) -> None:
        # Degradación elegante: un fallo del proveedor (red, credenciales,
        # rate limit) se loguea y no se propaga — el envío de email jamás
        # debe romper el flujo de negocio que lo dispara.
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    _RESEND_API_URL,
                    json={
                        "from": self._settings.email_from,
                        "to": [to],
                        "subject": subject,
                        "html": html,
                    },
                    headers={
                        "Authorization": f"Bearer {self._settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
        except Exception:
            logger.exception(
                "ResendEmailSender: no se pudo enviar el email (to=%s, subject=%r)",
                to,
                subject,
            )
