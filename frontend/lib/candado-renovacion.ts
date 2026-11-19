import { NetworkError, TIMEOUT_MESSAGE } from "@/lib/api";

/**
 * Candado entre pestañas para renovar la sesión (CON-02; ADR-0002,
 * actualización 2026-11-19).
 *
 * La cookie de renovación es una sola para todo el navegador, pero cada
 * pestaña (y la PWA instalada) renueva por su cuenta. Si dos salían casi a la
 * vez, la segunda llevaba la cookie que la primera acababa de rotar, y el
 * servidor lo tomaba por un robo: cerraba la sesión en todos los
 * dispositivos. Con el candado renuevan de a una: la que espera sale cuando
 * la otra ya recibió la respuesta, con la cookie nueva.
 *
 * Sin `navigator.locks` (navegadores viejos) se renueva como antes: el
 * servidor perdona el choque si llega dentro de los 30 segundos.
 */
export const CANDADO_RENOVACION = "oido-renovar-sesion";

/** Corre `renovar` con el candado tomado. Si el candado no se libera en
 * `esperaMaxMs` (una pestaña colgada; en iOS, una pestaña suspendida con el
 * candado), no se renueva y se contesta como un servidor que no respondió
 * («Reconectando…» al abrir la app, «sin conexión» en una pantalla): la
 * sesión no se da por terminada y la próxima renovación vuelve a intentar. Si el pedido del candado falla por
 * otra cosa, se renueva sin candado, como antes. */
export function conCandadoDeRenovacion<T>(
  renovar: () => Promise<T>,
  esperaMaxMs: number
): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== "function") return renovar();

  const espera = new AbortController();
  const tope = setTimeout(() => espera.abort(), esperaMaxMs);
  let renovando = false;
  let pedido: Promise<T>;
  try {
    pedido = locks.request(CANDADO_RENOVACION, { signal: espera.signal }, () => {
      clearTimeout(tope);
      renovando = true;
      return renovar();
    });
  } catch {
    clearTimeout(tope);
    return renovar();
  }
  return pedido
    .catch((err: unknown) => {
      // El error es de la renovación misma: pasa tal cual.
      if (renovando) throw err;
      // Sólo el tope de la espera aborta, y sólo antes de tomar el candado.
      if (espera.signal.aborted) throw new NetworkError(TIMEOUT_MESSAGE);
      return renovar();
    })
    .finally(() => clearTimeout(tope));
}
