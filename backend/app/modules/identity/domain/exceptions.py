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
