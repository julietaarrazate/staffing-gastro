"use client";

import { useSyncExternalStore } from "react";
import type { RelojKey } from "./fixtures";

/**
 * Estado del reloj del turno, compartido por toda la historia.
 *
 * Hay UN solo reloj en pantalla (fijo debajo del encabezado), y cada acto le
 * dice en qué estado está el turno mientras ese acto ocupa la pantalla. En los
 * tramos de scroll libre entre actos nadie escribe y el reloj se queda como
 * estaba: es justamente la idea (el reloj sólo avanza cuando alguien actúa).
 * `null` lo esconde (el hero, y de CONFIANZA para abajo).
 */
let current: RelojKey | null = null;
const listeners = new Set<() => void>();

export function setReloj(at: RelojKey | null) {
  if (at === current) return;
  current = at;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReloj(): RelojKey | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}
