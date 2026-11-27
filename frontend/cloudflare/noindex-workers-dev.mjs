// La dirección técnica `*.workers.dev` (la de prueba del Worker, `workers_dev`
// en `wrangler.jsonc`) sirve el mismo sitio que `www.oido.com.ar`. Si un
// buscador la indexara, habría dos copias de cada página compitiendo. Los
// canonical ya apuntan al dominio de Oído; con esto además se le pide que no
// la indexe: `X-Robots-Tag: noindex` en toda respuesta cuyo host termina en
// `workers.dev`. El dominio propio no lleva la cabecera.

/** @param {string} host */
export function esWorkersDev(host) {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === "workers.dev" || h.endsWith(".workers.dev");
}

/**
 * Envuelve el `fetch` del Worker.
 * @param {{ fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }} handler
 */
export function conNoindexEnWorkersDev(handler) {
  return {
    async fetch(request, env, ctx) {
      const respuesta = await handler.fetch(request, env, ctx);
      // Un upgrade a WebSocket (101) lleva `webSocket`: rearmar la respuesta lo
      // perdería. Se devuelve tal cual.
      if (respuesta.status === 101 || /** @type {any} */ (respuesta).webSocket) return respuesta;
      if (!esWorkersDev(new URL(request.url).hostname)) return respuesta;
      // Copia con cabeceras propias: la original puede ser inmutable.
      const r = new Response(respuesta.body, respuesta);
      r.headers.set("X-Robots-Tag", "noindex");
      return r;
    },
  };
}
