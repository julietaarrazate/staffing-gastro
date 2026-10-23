// `_headers` de Cloudflare para los assets estáticos (los sirve Cloudflare
// antes de llegar al Worker, así que no pasan por el `headers()` de
// `next.config.ts`). Lo escribe `cf-static-assets.mjs`; separado para poder
// testearlo (`cf-headers.test.ts`).
//
// Sin regla, Workers sirve cada asset con `max-age=0, must-revalidate`: en
// cada visita el navegador revalida (304) todos los chunks de JS y CSS.
// Caché larga SÓLO para lo que cambia de nombre cuando cambia el contenido:
//
// - `/_next/static/*`: chunks, CSS y fuentes llevan el hash del contenido en
//   el nombre; un deploy nuevo genera nombres nuevos. Es la regla que
//   recomienda OpenNext para Cloudflare.
// - `/maplibre/*`: el worker de MapLibre no lleva hash en el nombre, pero la
//   app lo pide con `?v=<versión de maplibre-gl>` (`lib/map/worker.ts`), así
//   que al subir de versión la URL cambia y no se mezcla un worker viejo con
//   la librería nueva.
// - `/landing/*` y `/logo-*`: fotos de la landing y logos, sin versión.
//   Pueden cambiar (fotos de prueba, isotipo pendiente), así que caché de un
//   día y una semana sirviendo la copia vieja mientras revalida: lo peor es
//   ver la foto o el logo anterior un rato.
//
// Sin regla a propósito (siguen revalidando siempre): `/sw.js` (el navegador
// necesita ver el service worker nuevo), `/manifest.webmanifest`, los íconos
// de la PWA y el HTML.
export const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/maplibre/*
  Cache-Control: public, max-age=31536000, immutable

/landing/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/logo-*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/og/oido.jpg
  Cache-Control: public, max-age=3600, must-revalidate

/twitter-image
  Content-Type: image/png
  Cache-Control: public, max-age=3600, must-revalidate
`;
