"use client";

import { useEffect, useState } from "react";

/**
 * `true` si el recorrido guiado de `storageKey` todavía no se vio. Sirve para
 * montar `GuidedTour` (que se carga aparte con `next/dynamic`) sólo cuando hay
 * algo que mostrar: quien ya lo vio no baja ese código. Arranca en `false`
 * (igual en servidor y cliente) y se resuelve al hidratar.
 */
export function useTourPendiente(storageKey: string): boolean {
  const [pendiente, setPendiente] = useState(false);
  useEffect(() => {
    try {
      setPendiente(!localStorage.getItem(storageKey));
    } catch {
      setPendiente(false);
    }
  }, [storageKey]);
  return pendiente;
}
