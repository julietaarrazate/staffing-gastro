"""`GoogleTokenInfoVerifier`: adaptador real de verificación de ID tokens.

Llama al endpoint `tokeninfo` de Google con `httpx` (misma decisión que
`ResendEmailSender`: sin SDK nuevo por un único endpoint simple — el proyecto
ya trae `httpx` como dependencia de test/infra). Google documenta este
endpoint como válido para verificar ID tokens sin librería; la alternativa
(`google-auth`, que valida la firma localmente contra las claves públicas
JWK cacheadas) suma ~5 paquetes transitivos para ganar, en la práctica, un
único round-trip HTTP menos por login — no se justifica para el volumen de
Staffya. Ver derivación completa en docs/ACCESO_MODERNO.md.
"""

import logging

import httpx

from app.core.config import Settings
from app.modules.identity.domain.exceptions import (
    GoogleAuthNotConfiguredError,
    GoogleTokenInvalidError,
)
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier

logger = logging.getLogger(__name__)

_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleTokenInfoVerifier(GoogleTokenVerifier):
    """Adaptador real: valida el ID token contra el endpoint tokeninfo de Google."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def verify(self, id_token: str) -> GoogleIdentity:
        if not self._settings.google_client_id:
            raise GoogleAuthNotConfiguredError()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(_TOKENINFO_URL, params={"id_token": id_token})
        except Exception as exc:
            logger.warning("GoogleTokenInfoVerifier: no se pudo contactar a Google: %s", exc)
            raise GoogleTokenInvalidError() from exc

        if response.status_code != 200:
            # Google devuelve 400 con {"error_description": "..."} para
            # tokens inválidos/expirados/malformados.
            raise GoogleTokenInvalidError()

        info = response.json()

        # Audience: el token debe haber sido emitido para ESTA app, no para
        # cualquier cliente de Google — si no se chequea, cualquier ID token
        # válido de Google (de otra app) serviría para loguearse acá.
        if info.get("aud") != self._settings.google_client_id:
            raise GoogleTokenInvalidError()

        email = (info.get("email") or "").strip().lower()
        if not email:
            raise GoogleTokenInvalidError()

        # `email_verified` viaja como string ("true"/"false") en algunas
        # respuestas del endpoint tokeninfo y como bool en otras — se
        # normaliza en vez de asumir un tipo.
        email_verified = str(info.get("email_verified", "")).lower() == "true"

        return GoogleIdentity(
            email=email,
            email_verified=email_verified,
            full_name=info.get("name") or email.split("@")[0],
        )
