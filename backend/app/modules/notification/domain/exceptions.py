"""Excepciones del dominio de notificaciones."""


class NotificationError(Exception):
    """Excepción base del módulo notification."""


class NotificationNotFoundError(NotificationError):
    """No se encontró la notificación solicitada (o no pertenece al usuario)."""
