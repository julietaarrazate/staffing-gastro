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
    """La postulación no existe (o no pertenece al trabajador que la busca).

    No-disclosure: mismo error para "no existe" y "es de otro trabajador".
    """


class InvalidApplicationTransitionError(ApplicationError):
    """La transición de estado solicitada no es válida desde el estado actual."""
