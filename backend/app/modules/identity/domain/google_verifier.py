"""Puerto de verificación de ID tokens de Google (Google Identity Services).

Arquitectura hexagonal, mismo criterio que `notification/domain/email_sender.py`:
el dominio sólo conoce el contrato; la verificación real (HTTP contra Google)
vive en la capa de infraestructura.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class GoogleIdentity:
    """Identidad resuelta a partir de un ID token de Google ya validado."""

    email: str
    email_verified: bool
    full_name: str


class GoogleTokenVerifier(ABC):
    """Puerto de verificación de ID tokens de Google."""

    @abstractmethod
    async def verify(self, id_token: str) -> GoogleIdentity:
        """Verifica un ID token y devuelve la identidad que certifica.

        Implementaciones deben lanzar:
        - `GoogleAuthNotConfiguredError` si no hay `GOOGLE_CLIENT_ID` configurado.
        - `GoogleTokenInvalidError` si el token es inválido, expiró, tiene
          firma incorrecta, o no pertenece a este client_id (audience).
        """
