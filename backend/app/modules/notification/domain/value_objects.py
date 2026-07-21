"""Objetos de valor del dominio de notificaciones."""

from enum import Enum


class NotificationType(str, Enum):
    """Tipos de evento que generan una notificación in-app."""

    SHIFT_ASSIGNED = "shift_assigned"
    SHIFT_CONFIRMED = "shift_confirmed"
    SHIFT_REJECTED = "shift_rejected"
    SHIFT_CHECKED_OUT = "shift_checked_out"
    SHIFT_PAID = "shift_paid"
    SHIFT_REOPENED = "shift_reopened"
    CHAT_MESSAGE = "chat_message"
    REVIEW_RECEIVED = "review_received"
    NEW_APPLICANT = "new_applicant"
    # ADR-0007 (Parte C, PRIMER_TURNO_REAL_SPEC): no-show y cancelación
    # tardía del comercio.
    SHIFT_NO_SHOW = "shift_no_show"
    SHIFT_CANCELLED_LATE = "shift_cancelled_late"
