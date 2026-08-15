"""Excepciones del dominio de turnos guardados."""


class SavedShiftError(Exception):
    """Excepción base del módulo saved_shift."""


class ShiftNotSavableError(SavedShiftError):
    """El turno no existe (no-disclosure: mismo error para inexistente)."""
