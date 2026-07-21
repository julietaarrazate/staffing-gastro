"use client";

import { useRef } from "react";

/**
 * Keys de idempotencia por intento de mutación crítica (ver
 * `product/IDEMPOTENCIA_SPEC.md` y `lib/api.ts`). Un botón tocado dos veces o
 * un reintento manual tras un error de red no deben duplicar la acción del
 * lado del backend: se manda el mismo UUID mientras sea el MISMO intento.
 *
 * Uso: identificar la acción con un string estable (p. ej. `${shiftId}:confirm`
 * o simplemente el id del turno si el botón no se reusa para otras acciones).
 * `keyFor` genera la key la primera vez y la reusa en llamadas siguientes;
 * `clear` se llama tras un intento que terminó bien (éxito, o un error de
 * negocio definitivo que no tiene sentido reintentar) para que la PRÓXIMA
 * vez que se dispare la misma acción sea un intento nuevo con key nueva. Si
 * no se llama a `clear` (p. ej. quedó pendiente por un error de red), la
 * key persiste: un reintento del usuario reusa el mismo intento.
 */
export function useIdempotencyKeys() {
  const keys = useRef<Record<string, string>>({});

  function keyFor(action: string): string {
    let key = keys.current[action];
    if (!key) {
      key = crypto.randomUUID();
      keys.current[action] = key;
    }
    return key;
  }

  function clear(action: string): void {
    delete keys.current[action];
  }

  return { keyFor, clear };
}
