"use client";

import { useRef } from "react";
import { ApiError } from "@/lib/api";
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
 * Un intento sin terminar no dura para siempre: pasada la ventana de
 * reintento (`VENTANA_REINTENTO_MS`) la key se descarta sola. Si no, una key
 * que quedó de una respuesta perdida repetiría, horas después y en la misma
 * pantalla abierta, la respuesta vieja a una acción nueva (CON-12: un
 * «Confirmar» tras una reasignación mostraba «¡Confirmado!» sin confirmar).
 * `clearSiTermino` suelta la key también ante un error definitivo.
 *
 * `recordar`/`recordado` guardan junto a la key el dato que se armó en el
 * primer intento (la posición de «Llegué»/«Terminé»): el reintento manda el
 * mismo cuerpo y no «un pedido distinto» (CON-01).
 *
 * Con `persistKey` las keys también se guardan en `sessionStorage`: una
 * recarga a mitad de un intento sin respuesta sigue siendo el MISMO intento
 * (BK-7DCC7E4AB945). Sin almacenamiento se comporta igual que sin la opción.
 */
/** Cuánto sigue siendo «el mismo intento» una key sin terminar. Un reintento
 * por una respuesta perdida llega en segundos o pocos minutos. */
export const VENTANA_REINTENTO_MS = 5 * 60_000;

type Entrada = { k: string; t: number; p?: unknown };

/** Un error con respuesta del servidor que no tiene sentido reintentar con la
 * misma key: el intento terminó (no es red, ni timeout, ni «en curso»). */
export function esErrorDefinitivo(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  // 408, 409 (carrera del turno) y 429 (límite de frecuencia) se reintentan
  // con la misma clave: el pedido no llegó a hacerse.
  return (
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 408 &&
    err.status !== 409 &&
    err.status !== 429
  );
}

export function useIdempotencyKeys(persistKey?: string) {
  const keys = useRef<Record<string, Entrada> | null>(null);

  function current(): Record<string, Entrada> {
    if (keys.current === null) {
      const guardado = (persistKey && leerSesion<Record<string, Entrada | string>>(persistKey)) || {};
      const todo: Record<string, Entrada> = {};
      for (const [accion, v] of Object.entries(guardado)) {
        // Formato viejo: sólo el string de la key.
        todo[accion] = typeof v === "string" ? { k: v, t: Date.now() } : v;
      }
      keys.current = todo;
    }
    return keys.current;
  }

  function persist(): void {
    if (!persistKey) return;
    if (Object.keys(current()).length === 0) borrarSesion(persistKey);
    else guardarSesion(persistKey, current());
  }

  function vigente(action: string): Entrada | undefined {
    const e = current()[action];
    if (e && Date.now() - e.t > VENTANA_REINTENTO_MS) {
      delete current()[action];
      persist();
      return undefined;
    }
    return e;
  }

  function keyFor(action: string): string {
    let e = vigente(action);
    if (!e) {
      e = { k: crypto.randomUUID(), t: Date.now() };
      current()[action] = e;
      persist();
    }
    return e.k;
  }

  /** Guarda el dato del primer intento junto a la key de esa acción. */
  function recordar<T>(action: string, valor: T): void {
    const e = vigente(action);
    if (!e) return;
    e.p = valor;
    persist();
  }

  /** El dato guardado por el primer intento, si la key sigue vigente. */
  function recordado<T>(action: string): T | undefined {
    return vigente(action)?.p as T | undefined;
  }

  function clear(action: string): void {
    delete current()[action];
    persist();
  }

  /** Suelta la key si el error es definitivo; ante un error de red la deja
   * para que el reintento sea el mismo intento. */
  function clearSiTermino(action: string, err: unknown): void {
    if (esErrorDefinitivo(err)) clear(action);
  }

  return { keyFor, clear, clearSiTermino, recordar, recordado };
}
