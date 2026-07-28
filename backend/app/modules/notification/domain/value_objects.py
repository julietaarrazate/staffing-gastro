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


# Pantalla que abre cada push al tocarlo. Sin esto todas las notificaciones
# caían en "/" (la landing) y el usuario tenía que buscar a mano de qué le
# hablaban — el aviso perdía la mitad de su utilidad. La pantalla se elige por
# el destinatario real de cada tipo (ver los `_notify_worker`/`_notify_company`
# de ShiftService): lo del trabajador va a sus turnos, lo del comercio a su
# panel.
_DEEP_LINKS: dict[NotificationType, str] = {
    # Trabajador
    NotificationType.SHIFT_ASSIGNED: "/my-shifts",
    NotificationType.SHIFT_PAID: "/my-shifts",
    NotificationType.SHIFT_NO_SHOW: "/my-shifts",
    NotificationType.SHIFT_CANCELLED_LATE: "/my-shifts",
    # Comercio
    NotificationType.NEW_APPLICANT: "/shifts",
    NotificationType.SHIFT_CONFIRMED: "/shifts",
    NotificationType.SHIFT_REJECTED: "/shifts",
    NotificationType.SHIFT_CHECKED_OUT: "/shifts",
    NotificationType.SHIFT_REOPENED: "/shifts",
    # Ambos roles
    NotificationType.CHAT_MESSAGE: "/chats",
    NotificationType.REVIEW_RECEIVED: "/profile",
}


def deep_link_for(type_: NotificationType) -> str:
    """Ruta del frontend que debe abrir el push de este tipo de notificación."""
    return _DEEP_LINKS.get(type_, "/")
