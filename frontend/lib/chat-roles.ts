import type { UserRole } from "@/lib/types";

/**
 * Quiénes tienen chats: el comercio y la persona asignada al turno. Una admin
 * no es parte de ningún chat. Las pantallas de chat usan esta lista en
 * `useRequireAuth({ roles })`: al salir de «Ver como» la sesión pasa a ser la
 * de la admin y, sin esta guarda, la pantalla que se deja volvía a pedir
 * `/chats/...` con esa sesión (404 y errores en la consola).
 */
export const CHAT_ROLES: readonly UserRole[] = ["worker", "employer"];
