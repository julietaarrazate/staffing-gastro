// Caché corta en el borde para `/sitemap.xml`.
//
// El mapa del sitio lleva los turnos abiertos, que pide el servidor al backend
// (`lib/sitemap-turnos.ts`). La página es `force-dynamic` y OpenNext no tiene
// caché incremental de escritura (`open-next.config.ts`), así que sin esto
// cada pedido, de buscadores o de cualquiera, llamaría al backend en Render.
// Se guarda una sola copia en la Cache API de Cloudflare (gratis, sin R2)
// `VIGENCIA_SEGUNDOS`: pasado ese tiempo se arma de nuevo.
//
// Qué NO se guarda: cualquier método que no sea GET, las respuestas que no son
// 200 y las que traen `Set-Cookie`. La clave es sólo la ruta. Va por dentro de
// `noindex-workers-dev.mjs`, para que la copia guardada no lleve esa cabecera.

export const VIGENCIA_SEGUNDOS = 600;

const ARMADA = "X-Oido-Armada";

/**
 * @param {Request} request
 * @returns {Request | null}
 */
export function claveDeSitemap(request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.pathname !== "/sitemap.xml") return null;
  return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
}

/** @param {Response} respuesta */
function seGuarda(respuesta) {
  return respuesta.status === 200 && !respuesta.headers.has("Set-Cookie");
}

/**
 * Envuelve el `fetch` del Worker con la caché de `/sitemap.xml`.
 * @param {{ fetch: (request: Request, env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) => Promise<Response> }} handler
 * @param {() => { match: (k: Request) => Promise<Response | undefined>, put: (k: Request, r: Response) => Promise<void>, delete: (k: Request) => Promise<boolean> } | undefined} obtenerCache
 * @param {() => number} [ahora] reloj en ms (para los tests)
 */
export function conCacheDeSitemap(handler, obtenerCache, ahora = Date.now) {
  return {
    async fetch(request, env, ctx) {
      const clave = claveDeSitemap(request);
      const cache = clave ? obtenerCache() : undefined;
      if (!clave || !cache) return handler.fetch(request, env, ctx);

      const guardada = await cache.match(clave);
      if (guardada) {
        const edad = (ahora() - Number(guardada.headers.get(ARMADA))) / 1000;
        if (edad >= 0 && edad <= VIGENCIA_SEGUNDOS) return paraElNavegador(guardada);
      }

      const respuesta = await handler.fetch(request, env, ctx);
      if (!seGuarda(respuesta)) {
        await cache.delete(clave);
        return respuesta;
      }
      const paraGuardar = new Response(respuesta.body, respuesta);
      paraGuardar.headers.set(ARMADA, String(ahora()));
      const paraNavegador = quitarMarca(paraGuardar.clone());
      ctx.waitUntil(cache.put(clave, paraGuardar));
      return paraNavegador;
    },
  };
}

/** @param {Response} respuesta */
function quitarMarca(respuesta) {
  const r = new Response(respuesta.body, respuesta);
  r.headers.delete(ARMADA);
  return r;
}

/** @param {Response} respuesta */
function paraElNavegador(respuesta) {
  return quitarMarca(respuesta);
}
