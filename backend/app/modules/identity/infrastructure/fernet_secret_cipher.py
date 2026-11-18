"""Cifrado en reposo del secreto TOTP con Fernet (ADR-0023).

Fernet (de `cryptography`, que ya venía instalada por `pywebpush`) es
AES-128-CBC + HMAC-SHA256 con la clave de `TWO_FACTOR_ENCRYPTION_KEY`.
Admite varias claves separadas por coma (`MultiFernet`): la primera cifra y
todas descifran, para poder rotarla sin dejar a nadie afuera (pasos en
`docs/reference/PENDIENTE_OPERATIVO.md`).
"""

import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.modules.identity.domain.exceptions import TwoFactorNotConfiguredError
from app.modules.identity.domain.secret_cipher import SecretCipher

logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def _build(keys: str) -> MultiFernet | None:
    parts = [key.strip() for key in keys.split(",") if key.strip()]
    if not parts:
        return None
    try:
        return MultiFernet([Fernet(key.encode("ascii")) for key in parts])
    except (ValueError, TypeError, UnicodeEncodeError):
        # Sin loguear el valor: es la clave.
        logger.error("TWO_FACTOR_ENCRYPTION_KEY no es una clave Fernet válida")
        return None


class FernetSecretCipher(SecretCipher):
    def __init__(self, keys: str) -> None:
        self._fernet = _build(keys or "")

    @property
    def is_configured(self) -> bool:
        return self._fernet is not None

    def encrypt(self, plaintext: str) -> str:
        if self._fernet is None:
            raise TwoFactorNotConfiguredError()
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        if self._fernet is None:
            raise TwoFactorNotConfiguredError()
        try:
            return self._fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")
        except InvalidToken as exc:
            logger.error("El secreto de dos pasos no se puede descifrar con la clave actual")
            raise TwoFactorNotConfiguredError() from exc
