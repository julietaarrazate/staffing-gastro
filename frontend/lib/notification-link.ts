import type { Notification, NotificationType } from "@/lib/types";

/**
 * Destino genérico por tipo, para los avisos creados antes de que existiera
 * `link` (ver migración 0016). Espeja `deep_link_for` del backend.
 */
const BY_TYPE: Record<NotificationType, string> = {
  shift_assigned: "/my-shifts",
  shift_paid: "/my-shifts",
  shift_no_show: "/my-shifts",
  shift_cancelled_late: "/my-shifts",
  new_applicant: "/shifts",
  shift_confirmed: "/shifts",
  shift_rejected: "/shifts",
  shift_checked_out: "/shifts",
  shift_reopened: "/shifts",
  // Sólo al comercio (ADR-0015): si había un trabajador asignado sin
  // confirmar, no se le avisa nada — mismo criterio que el backend
  // (`deep_link_for` en notification/domain/value_objects.py).
  shift_not_covered: "/shifts",
  new_shift_nearby: "/feed",
  // Escalada automática de urgencia (ADR-0009): mismo destino que el aviso
  // común, el turno todavía no es suyo.
  urgent_shift_nearby: "/feed",
  chat_message: "/chats",
  review_received: "/profile",
  support_reply: "/support",
};

/** Pantalla que debe abrir una notificación al tocarla. */
export function notificationHref(notification: Notification): string {
  return notification.link || BY_TYPE[notification.type] || "/";
}
