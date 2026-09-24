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
