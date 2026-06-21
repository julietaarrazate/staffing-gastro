"""Excepciones del dominio de perfil del comercio."""


class CompanyError(Exception):
    """Excepción base del módulo company."""


class CompanyProfileAlreadyExistsError(CompanyError):
    """El usuario ya tiene un perfil de comercio."""


class CompanyProfileNotFoundError(CompanyError):
    """No se encontró el perfil de comercio solicitado."""
