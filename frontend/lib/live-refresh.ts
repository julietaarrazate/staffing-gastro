"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Pantallas al día (G1, U013/U014/U016). Cada pantalla carga una vez al
 * entrar; lo que cambia después (el trabajador confirmó, el comercio canceló)
 * llega como aviso por el WebSocket de la campanita, pero la campanita no le
 * avisaba a nadie más. Este módulo es ese aviso: la campanita llama a
 * `emitLiveRefresh()` y cada pantalla que se suscribe con `useLiveRefresh`
 * vuelve a pedir lo suyo, en silencio.
 *
 * Disparadores: (1) llega un aviso por el WebSocket, (2) la persona toca un
 * aviso que apunta a la pantalla en la que ya está, (3) la pestaña vuelve a
 * estar visible o vuelve la conexión, (4) el WebSocket se reconecta. Los
 * emite la campanita (montada en el `Navbar` del layout raíz, o sea en todas
 * las pantallas con sesión, celular y escritorio) y los de (3) los resuelve el
 * hook por su cuenta.
 *
 * Sin consulta periódica: cada pedido despierta la base (Neon, con cuota), así
 * que el disparador es el aviso, nunca un reloj.
 */

const listeners = new Set<() => void>();

/** Le avisa a las pantallas suscritas que algo pudo haber cambiado. */
export function emitLiveRefresh(): void {
  for (const listener of [...listeners]) listener();
}

/** Varios avisos juntos (una ráfaga) valen una sola recarga. */
export const LIVE_REFRESH_DEBOUNCE_MS = 400;
/** Volver a la pestaña o a la red no recarga si hubo una recarga hace menos. */
export const LIVE_REFRESH_MIN_GAP_MS = 5_000;

export type LiveRefreshLoad = (options: { silent: true }) => unknown;

/**
 * Vuelve a pedir lo de la pantalla (`load({ silent: true })`) ante cada
 * disparador. `load` tiene que respetar `silent`: sin esqueleto de carga y sin
 * pisar lo que ya se ve con un error pasajero.
 *
 * - Con la pestaña oculta no pide nada: queda pendiente y se pide una vez al
 *   volver a verla.
 * - `paused` (un diálogo abierto, un formulario a medio escribir, una acción en
 *   curso): tampoco pide; queda pendiente y se pide al soltarse, para no pisar
 *   lo que la persona está haciendo ni cruzarse con su propio pedido.
 * - Una recarga en curso no se pisa con otra: si llega algo mientras tanto, se
 *   pide una vez más al terminar.
 */
export function useLiveRefresh(load: LiveRefreshLoad, options: { paused?: boolean } = {}): void {
  const paused = options.paused ?? false;
  const loadRef = useRef(load);
  const pausedRef = useRef(paused);
  useLayoutEffect(() => {
    loadRef.current = load;
    pausedRef.current = paused;
  });

  const flushRef = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;
    let running = false;
    let lastRunAt = 0;
    let disposed = false;

    const blocked = () => document.visibilityState !== "visible" || pausedRef.current;

    function run() {
      timer = null;
      if (disposed || !pending || running) return;
      if (blocked()) return; // sigue pendiente: lo retoma `flush`
      pending = false;
      running = true;
      lastRunAt = Date.now();
      let result: unknown;
      try {
        result = loadRef.current({ silent: true });
      } catch {
        result = undefined;
      }
      Promise.resolve(result)
        .catch(() => {})
        .finally(() => {
          running = false;
          if (pending) schedule();
        });
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, LIVE_REFRESH_DEBOUNCE_MS);
    }

    function request() {
      pending = true;
      if (blocked() || running) return; // se retoma solo (visible, soltar pausa, terminar)
      schedule();
    }

    function flush() {
      if (pending && !blocked() && !running) schedule();
    }
    flushRef.current = flush;

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      // Pendiente de un aviso que llegó con la pestaña oculta: se pide ya.
      if (pending) return flush();
      // Sin aviso pendiente, volver a la pestaña refresca salvo que se haya
      // refrescado hace un momento (cambiar de pestaña a cada rato no es una
      // ráfaga de pedidos).
      if (Date.now() - lastRunAt >= LIVE_REFRESH_MIN_GAP_MS) request();
    }

    function onOnline() {
      if (Date.now() - lastRunAt >= LIVE_REFRESH_MIN_GAP_MS) request();
    }

    listeners.add(request);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      listeners.delete(request);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Al soltarse la pausa, lo pendiente se pide.
  useEffect(() => {
    if (!paused) flushRef.current();
  }, [paused]);
}
