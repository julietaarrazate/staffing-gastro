// Caché corta en el borde para la página pública de un turno (`/turno/[id]`).
//
// Es la página que se abre cuando alguien comparte un turno por WhatsApp. En
// cada visita el Worker la armaba de cero y le pedía el turno a la API en
// Render (Ohio): de 1,3 a 2 s medidos desde un celular en Argentina
// (2026-10-19). Lo que arma el servidor es igual para cualquiera que la abra
// (lo de la sesión lo completa `ShiftDetail` en el navegador), así que se
// puede guardar una sola copia por turno en la caché de Cloudflare (Cache API,
// gratis, sin R2).
//
// Cómo se renueva: la copia está "fresca" `FRESCA_SEGUNDOS` y se sirve tal
// cual. Hasta `VIGENCIA_SEGUNDOS` se sirve igual, al instante, y por detrás se
// arma la nueva para el próximo visitante (stale-while-revalidate a mano: la
// Cache API no lo hace sola). Pasado eso, se arma en el momento. Con 60 s
// solos casi nadie encontraba la copia: la caché es por centro de datos y un
// turno se abre de a ratos. Si al renovar el turno ya no da 200 (borrado,
// error), se borra la copia.
//
// Qué NO se guarda: cualquier método que no sea GET, los pedidos RSC de la
// navegación interna de Next (header `RSC` o `?_rsc=`), las respuestas que no
// son 200 y las que traen `Set-Cookie`. La clave es sólo la ruta: `?ref=wa` y
// parecidos no generan copias distintas.

export const FRESCA_SEGUNDOS = 60;
export const VIGENCIA_SEGUNDOS = 600;

// Cuándo se armó la copia (ms desde epoch). Sólo vive dentro de la caché.
const ARMADA = "X-Oido-Armada";

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

/** @param {Response} respuesta */
function seGuarda(respuesta) {
  return respuesta.status === 200 && !respuesta.headers.has("Set-Cookie");
}

/**
 * Envuelve el `fetch` del Worker de OpenNext con la caché de `/turno/[id]`.
 * @param {{ fetch: (request: Request, env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) => Promise<Response> }} handler
 * @param {() => { match: (k: Request) => Promise<Response | undefined>, put: (k: Request, r: Response) => Promise<void>, delete: (k: Request) => Promise<boolean> } | undefined} obtenerCache
 * @param {() => number} [ahora] reloj en ms (para los tests)
 */
export function conCacheDeTurno(handler, obtenerCache, ahora = Date.now) {
  return async function fetch(request, env, ctx) {
    const clave = claveDeTurno(request);
    const cache = clave ? obtenerCache() : undefined;
    if (!clave || !cache) return handler.fetch(request, env, ctx);

    // Arma la página y, si corresponde, la guarda. Devuelve la respuesta para
    // el navegador.
    async function armar() {
      const respuesta = await handler.fetch(request, env, ctx);
      if (!seGuarda(respuesta)) {
        await cache.delete(clave);
        return respuesta;
      }
      const paraGuardar = new Response(respuesta.body, respuesta);
      paraGuardar.headers.set("Cache-Control", `public, max-age=${VIGENCIA_SEGUNDOS}`);
      paraGuardar.headers.set(ARMADA, String(ahora()));
      const paraNavegador = paraElNavegador(paraGuardar.clone());
      ctx.waitUntil(cache.put(clave, paraGuardar));
      return paraNavegador;
    }

    const guardada = await cache.match(clave);
    if (guardada) {
      const edad = (ahora() - Number(guardada.headers.get(ARMADA))) / 1000;
      if (edad <= VIGENCIA_SEGUNDOS) {
        if (!(edad <= FRESCA_SEGUNDOS)) ctx.waitUntil(armar().catch(() => {}));
        return paraElNavegador(guardada);
      }
    }
    return armar();
  };
}

/** @param {Response} respuesta */
function paraElNavegador(respuesta) {
  const r = new Response(respuesta.body, respuesta);
  r.headers.set("Cache-Control", `public, max-age=${FRESCA_SEGUNDOS}`);
  r.headers.delete(ARMADA);
  return r;
}
