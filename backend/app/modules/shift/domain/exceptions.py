"""Excepciones del dominio de turnos."""


class ShiftError(Exception):
    """Excepción base del módulo shift."""


class ShiftNotFoundError(ShiftError):
    """No se encontró el turno solicitado (o no pertenece al comercio)."""


class InvalidShiftTransitionError(ShiftError):
    """La transición de estado solicitada no es válida desde el estado actual."""


class ShiftNotEditableError(ShiftError):
    """El turno no puede editarse en su estado actual."""


class InvalidShiftScheduleError(ShiftError):
    """El horario del turno es inválido (p. ej. fin anterior al inicio)."""


class ShiftNotAssignedToWorkerError(ShiftError):
    """El turno no está asignado al trabajador que intenta confirmarlo/rechazarlo."""
