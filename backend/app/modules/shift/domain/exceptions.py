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


class OverlappingShiftError(ShiftError):
    """El trabajador ya tiene otro turno comprometido cuyo horario se solapa
    con el que intenta confirmar (regla de doble turno)."""


class ShiftConcurrentModificationError(ShiftError):
    """Otro pedido modificó el turno entre que se leyó y se quiso guardar
    (ADR-0016). Nada se guardó: hay que volver a leerlo y decidir de nuevo."""
