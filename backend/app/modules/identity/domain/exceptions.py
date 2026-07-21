"""Excepciones del dominio de identidad.

Son agnósticas del transporte (no saben de HTTP). La capa de API las traduce
a códigos de estado apropiados.
"""


class IdentityError(Exception):
    """Excepción base del módulo de identidad."""


class EmailAlreadyExistsError(IdentityError):
    """Ya existe un usuario registrado con ese email."""


class InvalidCredentialsError(IdentityError):
    """Email o contraseña incorrectos."""


class UserNotFoundError(IdentityError):
    """No se encontró el usuario solicitado."""


class InactiveUserError(IdentityError):
    """La cuenta del usuario no está activa."""


class InvalidTokenError(IdentityError):
    """El token provisto es inválido, expiró o no es del tipo esperado."""


class RefreshTokenRevokedError(IdentityError):
    """El refresh token ya estaba revocado (rotado, deslogueado o reusado).

    Si se recibe en `/auth/refresh`, se interpreta como reuso de un token
    rotado: posible robo. Se revocan todas las sesiones del usuario.
    """


class PasswordResetTokenInvalidError(IdentityError):
    """El token de recuperación de contraseña es inválido, expiró o ya se usó.

    Deliberadamente genérico (no distingue "no existe" de "vencido" de "ya
    usado"): la API la traduce siempre al mismo 400 "Enlace inválido o
    vencido" (no-disclosure, mismo criterio que `RefreshTokenRevokedError`).
    """


class GoogleAuthNotConfiguredError(IdentityError):
    """`GOOGLE_CLIENT_ID` no está configurado en este servidor (flag por
    ausencia, ver `core/config.py`)."""


class GoogleTokenInvalidError(IdentityError):
    """El ID token de Google es inválido, expiró, tiene firma incorrecta o no
    pertenece a este client_id (audience)."""


class GoogleEmailNotVerifiedError(IdentityError):
    """Google no verificó el email asociado a la cuenta (`email_verified`
    en falso): no alcanza como prueba de identidad."""
