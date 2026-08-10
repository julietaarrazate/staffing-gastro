"""Excepciones del dominio de soporte."""


class SupportError(Exception):
    """Excepción base del módulo support."""


class TicketNotFoundError(SupportError):
    """El ticket no existe (o no pertenece a quien lo pide, no-disclosure)."""


class TicketClosedError(SupportError):
    """El ticket ya está cerrado: no admite nuevos mensajes."""


class EmptyMessageError(SupportError):
    """El mensaje (o el asunto inicial) no puede estar vacío."""
