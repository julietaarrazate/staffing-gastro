"use client";

import { createContext, useContext } from "react";
import type { Conversation } from "@/lib/types";

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
