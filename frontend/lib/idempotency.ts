"use client";

import { useRef } from "react";
import { borrarSesion, guardarSesion, leerSesion } from "@/lib/almacen-sesion";

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
 *
 * Con `persistKey` las keys también se guardan en `sessionStorage`: una
 * recarga a mitad de un intento sin respuesta sigue siendo el MISMO intento
 * (BK-7DCC7E4AB945). Sin almacenamiento se comporta igual que sin la opción.
 */
export function useIdempotencyKeys(persistKey?: string) {
  const keys = useRef<Record<string, string> | null>(null);

  function current(): Record<string, string> {
    if (keys.current === null) {
      keys.current = (persistKey && leerSesion<Record<string, string>>(persistKey)) || {};
    }
    return keys.current;
  }

  function persist(): void {
    if (!persistKey) return;
    if (Object.keys(current()).length === 0) borrarSesion(persistKey);
    else guardarSesion(persistKey, current());
  }

  function keyFor(action: string): string {
    const all = current();
    let key = all[action];
    if (!key) {
      key = crypto.randomUUID();
      all[action] = key;
      persist();
    }
    return key;
  }

  function clear(action: string): void {
    delete current()[action];
    persist();
  }

  return { keyFor, clear };
}
