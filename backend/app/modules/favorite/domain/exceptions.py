"""Excepciones del dominio de favoritos."""


class FavoriteError(Exception):
    """Excepción base del módulo favorite."""


class WorkerNotFavoritableError(FavoriteError):
    """El trabajador no existe (no-disclosure: mismo error para inexistente)."""
