import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Caché de sólo lectura con lo prerenderizado en el build. Oído no usa ISR
// (`revalidate`), así que no hace falta R2/KV. Sin esto, las rutas
// `force-static` como `/og/oido.jpg` se volvían a ejecutar en el Worker y
// fallaban: usan `sharp` y leen fuentes del disco, y ninguna de las dos
// cosas existe en Workers. Ver docs/reference/DEPLOY.md.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
