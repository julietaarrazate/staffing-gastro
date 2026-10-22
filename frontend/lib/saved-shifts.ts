"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";

/**
 * Qué turnos tiene guardados el trabajador, compartido por todos los
 * `SaveShiftButton` de la pantalla. Antes cada tarjeta del feed pedía
 * `/saved-shifts/{id}/status`: ~30 pedidos (más su preflight CORS cada uno)
 * por carga (medido 2026-10-22). Ahora es un solo `/saved-shifts/ids` por
 * sesión, y guardar o quitar actualiza el mismo conjunto.
 */

type State = { token: string; ids: Set<string> } | null;

let state: State = null;
let inflight: { token: string; promise: Promise<void> } | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(token: string): Promise<void> {
  if (state?.token === token) return Promise.resolve();
  if (inflight?.token === token) return inflight.promise;
  const promise = api
    .get<{ shift_ids: string[] }>("/saved-shifts/ids", token)
    .then((data) => {
      state = { token, ids: new Set(data.shift_ids) };
      emit();
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { token, promise };
  return promise;
}

/** `null` mientras no se sabe (o si el pedido falló): el botón no se muestra. */
export function useIsShiftSaved(shiftId: string, token: string | null): boolean | null {
  useEffect(() => {
    if (!token) return;
    // Si falla, el botón queda oculto en vez de mostrar un estado que podría
    // ser falso (mismo criterio que antes, por tarjeta).
    load(token).catch(() => {});
  }, [token]);

  return useSyncExternalStore(
    subscribe,
    () => (token && state?.token === token ? state.ids.has(shiftId) : null),
    () => null,
  );
}

/** Actualización optimista (y su reversión) desde el botón. */
export function setShiftSaved(shiftId: string, saved: boolean) {
  if (!state) return;
  const ids = new Set(state.ids);
  if (saved) ids.add(shiftId);
  else ids.delete(shiftId);
  state = { token: state.token, ids };
  emit();
}
