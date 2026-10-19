// Entrada del Worker: el handler que arma OpenNext más la caché corta de
// `/turno/[id]` (ver `turno-cache.mjs`). `wrangler.jsonc` apunta acá.
// `.open-next/worker.js` lo genera `opennextjs-cloudflare build`.
import handler from "../.open-next/worker.js";
import { conCacheDeTurno } from "./turno-cache.mjs";

// Los Durable Objects que OpenNext exporta tienen que salir de la entrada.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";

const worker = {
  fetch: conCacheDeTurno(handler, () =>
    typeof caches === "undefined" ? undefined : caches.default
  ),
};

export default worker;
