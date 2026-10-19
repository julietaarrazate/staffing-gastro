// Caché corta en el borde para la página pública de un turno (`/turno/[id]`).
//
// Es la página que se abre cuando alguien comparte un turno por WhatsApp. En
// cada visita el Worker la armaba de cero y le pedía el turno a la API en
// Render (Ohio): de 1,3 a 2 s medidos desde un celular en Argentina
// (2026-10-19). Lo que arma el servidor es igual para cualquiera que la abra
// (lo de la sesión lo completa `ShiftDetail` en el navegador), así que se
// puede guardar una sola copia por turno durante `TTL_SEGUNDOS` en la caché
// de Cloudflare (Cache API, gratis, sin R2).
//
// Qué NO se guarda: cualquier método que no sea GET, los pedidos RSC de la
// navegación interna de Next (header `RSC` o `?_rsc=`), las respuestas que no
// son 200 y las que traen `Set-Cookie`. La clave es sólo la ruta: `?ref=wa` y
// parecidos no generan copias distintas.

export const TTL_SEGUNDOS = 60;

const RUTA_TURNO = /^\/turno\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La clave de caché para este pedido, o `null` si no se cachea.
 * @param {Request} request
 * @returns {Request | null}
 */
export function claveDeTurno(request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (!RUTA_TURNO.test(url.pathname)) return null;
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return null;
  if (request.headers.has("Next-Router-Prefetch") || request.headers.has("Next-Router-State-Tree")) {
    return null;
  }
  return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
}

/**
 * Envuelve el `fetch` del Worker de OpenNext con la caché de `/turno/[id]`.
 * @param {{ fetch: (request: Request, env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) => Promise<Response> }} handler
 * @param {() => { match: (k: Request) => Promise<Response | undefined>, put: (k: Request, r: Response) => Promise<void> } | undefined} obtenerCache
 */
export function conCacheDeTurno(handler, obtenerCache) {
  return async function fetch(request, env, ctx) {
    const clave = claveDeTurno(request);
    const cache = clave ? obtenerCache() : undefined;
    if (!clave || !cache) return handler.fetch(request, env, ctx);

    const guardada = await cache.match(clave);
    if (guardada) return guardada;

    const respuesta = await handler.fetch(request, env, ctx);
    if (respuesta.status !== 200 || respuesta.headers.has("Set-Cookie")) return respuesta;

    const copia = new Response(respuesta.body, respuesta);
    copia.headers.set("Cache-Control", `public, max-age=${TTL_SEGUNDOS}`);
    ctx.waitUntil(cache.put(clave, copia.clone()));
    return copia;
  };
}
