"""Excepciones del dominio de reseñas."""


class ReviewError(Exception):
    """Excepción base del módulo review."""


class ShiftNotReviewableError(ReviewError):
    """El turno no existe, no es accesible o todavía no se puede calificar.

    No-disclosure: el mismo error cubre "no existe", "no es tuyo" y "todavía
    no está cerrado", para no revelar turnos ajenos.
    """


class DuplicateReviewError(ReviewError):
    """El usuario ya dejó una reseña para ese turno."""


class InvalidRatingError(ReviewError):
    """La calificación debe ser un entero entre 1 y 5."""
