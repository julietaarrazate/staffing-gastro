"""Excepciones del dominio de postulaciones."""


class ApplicationError(Exception):
    """Excepción base del módulo application."""


class ShiftNotApplicableError(ApplicationError):
    """El turno no existe, no es accesible o no está abierto a postulaciones.

    No-disclosure: el mismo error cubre "no existe", "no es tuyo" y "no está
    abierto", para no revelar turnos ajenos.
    """


class AlreadyAppliedError(ApplicationError):
    """El trabajador ya se postuló a ese turno."""


class ApplicationNotFoundError(ApplicationError):
    """La postulación no existe."""
