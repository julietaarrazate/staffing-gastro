// Entrada del Worker: el handler que arma OpenNext más la caché corta de
// `/turno/[id]` (ver `turno-cache.mjs`). `wrangler.jsonc` apunta acá.
// `.open-next/worker.js` lo genera `opennextjs-cloudflare build`.
import handler from "../.open-next/worker.js";
import { conCacheDeTurno } from "./turno-cache.mjs";
import { conNoindexEnWorkersDev } from "./noindex-workers-dev.mjs";

// Los Durable Objects que OpenNext exporta tienen que salir de la entrada.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";

// `*.workers.dev` no se indexa (`noindex-workers-dev.mjs`): va por fuera de la
// caché, así la cabecera sale también en las páginas servidas desde ella.
const worker = conNoindexEnWorkersDev({
  fetch: conCacheDeTurno(handler, () =>
    typeof caches === "undefined" ? undefined : caches.default
  ),
});

export default worker;
