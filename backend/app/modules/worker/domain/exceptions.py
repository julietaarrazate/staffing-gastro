"""Excepciones del dominio de perfil del trabajador."""


class WorkerError(Exception):
    """Excepción base del módulo worker."""


class WorkerProfileAlreadyExistsError(WorkerError):
    """El usuario ya tiene un perfil de trabajador."""


class WorkerProfileNotFoundError(WorkerError):
    """No se encontró el perfil de trabajador solicitado."""
