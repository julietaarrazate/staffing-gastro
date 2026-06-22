"""Objetos de valor del dominio de notificaciones."""

from enum import Enum


class NotificationType(str, Enum):
    """Tipos de evento que generan una notificación in-app."""

    SHIFT_ASSIGNED = "shift_assigned"
    SHIFT_CONFIRMED = "shift_confirmed"
    SHIFT_REJECTED = "shift_rejected"
    SHIFT_CHECKED_OUT = "shift_checked_out"
    SHIFT_PAID = "shift_paid"
    CHAT_MESSAGE = "chat_message"
