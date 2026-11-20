"use client";

import { createContext, useContext } from "react";
import { SKILL_LABELS, type Conversation } from "@/lib/types";

/**
 * La lista de conversaciones que ya cargó `layout.tsx`, para que la
 * conversación abierta sepa con quién es y de qué turno sin pedirla otra vez
 * al backend. Vacía mientras carga o si falló: el encabezado del chat
 * simplemente no se muestra hasta tenerla.
 */
export const ConversationsContext = createContext<Conversation[]>([]);

export function useConversation(shiftId: string): Conversation | undefined {
  return useContext(ConversationsContext).find((c) => c.shift_id === shiftId);
}

/**
 * Lo que la conversación abierta necesita del layout además de la lista:
 * `reload` vuelve a pedirla en silencio (al mandar el primer mensaje, hasta
 * entonces el hilo no tiene mensajes y por eso no figura: U016) y `ready` dice
 * que ya se intentó cargarla (bien o mal), para no pedir el turno de más
 * mientras la lista todavía está en camino.
 */
export const ConversationsControlContext = createContext<{ reload: () => void; ready: boolean }>({
  reload: () => {},
  ready: false,
});

export function useConversationsControl(): { reload: () => void; ready: boolean } {
  return useContext(ConversationsControlContext);
}

/**
 * El turno del que cuelga un chat, como se lee en el resto de la app. Sin
 * título propio, el backend manda el puesto tal cual lo guarda ("mozo"): acá
 * pasa a su nombre ("Mozo/a"), igual que en el encabezado de una conversación
 * todavía sin mensajes.
 */
export function shiftLabel(shiftTitle: string): string {
  return (SKILL_LABELS as Record<string, string>)[shiftTitle] ?? shiftTitle;
}
