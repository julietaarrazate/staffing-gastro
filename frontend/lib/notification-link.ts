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
  new_shift_nearby: "/feed",
  chat_message: "/chats",
  review_received: "/profile",
};

/** Pantalla que debe abrir una notificación al tocarla. */
export function notificationHref(notification: Notification): string {
  return notification.link || BY_TYPE[notification.type] || "/";
}
