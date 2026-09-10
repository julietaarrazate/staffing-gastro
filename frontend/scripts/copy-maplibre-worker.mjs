/**
 * Copia el worker de MapLibre a `public/maplibre/` para poder servirlo desde
 * nuestro propio origen.
 *
 * POR QUÉ EXISTE (si lo vas a borrar, leé esto primero):
 *
 * maplibre-gl 6 resuelve la URL de su web worker así (dist/maplibre-gl.mjs):
 *
 *     let e = import.meta.url;
 *     if (!/^https?:/.test(e)) return ``;      // <-- cadena VACÍA
 *     return new URL(`./maplibre-gl-worker.mjs`, e).href;
 *
 * Dentro del bundle de Next, `import.meta.url` NO es una URL http(s), así que
 * esa función devuelve `""` y maplibre termina haciendo
 * `new Worker("", { type: "module" })`. El worker falla al arrancar, ningún
 * tile se parsea nunca, el evento `load` no se dispara JAMÁS y el mapa queda
 * en blanco: sin fondo, sin marcadores y **sin un solo error en consola** (el
 * `error` del worker llega con `message` vacío y maplibre no lo re-emite).
 *
 * Medido, no deducido: con un estilo cuyo `sources` está vacío el mapa carga
 * bien; basta que UNA capa use una fuente vectorial —como el estilo real de
 * CARTO, y a diferencia del estilo mockeado de los tests e2e— para que no
 * cargue nunca. Por eso el bug no lo vio ningún test: el mock nunca ejercitó
 * el worker.
 *
 * El fix es servir el worker desde nuestro origen y decírselo a maplibre por
 * `config.WORKER_URL` (ver `lib/map/worker.ts`). El worker importa a su vez
 * `./maplibre-gl-shared.mjs`, así que los dos archivos van al mismo directorio.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const destino = join(raiz, "public", "maplibre");
const origen = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));

// El worker y el módulo compartido que él mismo importa por ruta relativa.
const ARCHIVOS = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(destino, { recursive: true });
for (const archivo of ARCHIVOS) {
  const desde = join(origen, archivo);
  if (!existsSync(desde)) {
    // Fallar fuerte: si esto se rompe en silencio, el mapa se rompe en
    // silencio (que es exactamente lo que pasó antes).
    throw new Error(
      `No se encontró ${desde}. ¿Cambió el layout de dist/ de maplibre-gl? ` +
        `El mapa no va a funcionar sin este archivo — ver scripts/copy-maplibre-worker.mjs.`
    );
  }
  copyFileSync(desde, join(destino, archivo));
}
console.log(`[maplibre] worker copiado a public/maplibre/ (${ARCHIVOS.join(", ")})`);
