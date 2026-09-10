import { config } from "maplibre-gl";

/**
 * URL del worker de MapLibre, servido desde NUESTRO origen.
 *
 * maplibre-gl 6 arma sola esta URL a partir de `import.meta.url`, pero dentro
 * del bundle de Next eso no es una URL http(s): su propia función devuelve
 * cadena vacía y termina en `new Worker("", { type: "module" })`. El worker no
 * arranca, ningún tile vectorial se parsea, el evento `load` no llega nunca y
 * el mapa queda en blanco sin ningún error visible. Ver el detalle medido en
 * `scripts/copy-maplibre-worker.mjs`, que es el que deja los archivos acá.
 *
 * Mismo origen a propósito: así maplibre usa el `Worker` directo (sin envolver
 * en un blob) y la CSP lo permite con `worker-src 'self'` — ver `next.config.ts`.
 */
export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

config.WORKER_URL = MAPLIBRE_WORKER_URL;
