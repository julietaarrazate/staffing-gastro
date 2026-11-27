// Entrada del Worker: el handler que arma OpenNext más la caché corta de
// `/turno/[id]` (ver `turno-cache.mjs`). `wrangler.jsonc` apunta acá.
// `.open-next/worker.js` lo genera `opennextjs-cloudflare build`.
import handler from "../.open-next/worker.js";
import { conCacheDeTurno } from "./turno-cache.mjs";
import { conCacheDeSitemap } from "./sitemap-cache.mjs";
import { conNoindexEnWorkersDev } from "./noindex-workers-dev.mjs";

// Los Durable Objects que OpenNext exporta tienen que salir de la entrada.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";

// De adentro hacia afuera: caché de turnos, caché del mapa del sitio y, por
// fuera de las dos, `noindex` en `*.workers.dev` (`noindex-workers-dev.mjs`):
// así la cabecera sale también en lo servido desde caché y las copias
// guardadas no la llevan.
const cache = () => (typeof caches === "undefined" ? undefined : caches.default);
const worker = conNoindexEnWorkersDev(
  conCacheDeSitemap({ fetch: conCacheDeTurno(handler, cache) }, cache)
);

export default worker;
