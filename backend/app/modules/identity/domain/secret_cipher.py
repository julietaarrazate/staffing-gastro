"""Puerto del cifrado en reposo del secreto TOTP (ADR-0023).

El dominio y los casos de uso sólo saben cifrar y descifrar un texto; la
implementación (Fernet, con la clave de `TWO_FACTOR_ENCRYPTION_KEY`) vive en
`infrastructure/fernet_secret_cipher.py`.
"""

from abc import ABC, abstractmethod


class SecretCipher(ABC):
    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """False si falta la clave (o no es válida): sin ella no se puede
        dar de alta ni verificar nada."""

    @abstractmethod
    def encrypt(self, plaintext: str) -> str:
        """Cifra y devuelve un texto apto para guardar en la base."""

    @abstractmethod
    def decrypt(self, ciphertext: str) -> str:
        """Descifra. Falla con `TwoFactorNotConfiguredError` si la clave no
        sirve para ese texto (clave cambiada sin la vieja)."""
