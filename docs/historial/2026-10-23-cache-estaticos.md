# Cloudflare: los archivos con hash se cachean un año (visita repetida sin revalidar) (#500)

**Pedido:** Julieta, 2026-10-23: seguir con el relevamiento de rendimiento
del frontend (ítem 8b, caché de estáticos), midiendo antes y después.

**Qué cambió:** al volver a entrar a Oído, el celular ya no le pregunta al
servidor por cada archivo de JavaScript, CSS y fuentes: los usa directo de
la caché. La primera visita no cambia.

- `frontend/scripts/cf-headers.mjs` (nuevo): el texto del `_headers` de
  Cloudflare, con el motivo de cada regla. Lo escribe
  `frontend/scripts/cf-static-assets.mjs` igual que antes.
- Reglas nuevas:
  - `/_next/static/*` → `public, max-age=31536000, immutable`. Seguro porque
    cada archivo lleva el hash de su contenido en el nombre: un deploy nuevo
    genera nombres nuevos. Es lo que recomienda OpenNext para Cloudflare.
  - `/maplibre/*` → lo mismo. El worker de MapLibre **no** lleva hash en el
    nombre, así que ahora la app lo pide con `?v=<versión de maplibre-gl>`
    (`frontend/lib/map/worker.ts`; la versión la inyecta
    `frontend/next.config.ts` desde el `package.json` del paquete). Al subir
    maplibre cambia la URL y no se mezcla un worker viejo con la librería
    nueva. El worker no importa nada por ruta relativa (el `-shared.mjs`
    está vacío), así que el `?v=` alcanza.
  - `/landing/*` y `/logo-*` → `public, max-age=86400,
    stale-while-revalidate=604800`. Sin versión y pueden cambiar (fotos de
    prueba, isotipo pendiente): lo peor es ver la foto o el logo anterior un
    día.
  - Sin regla a propósito: `/sw.js` (el navegador tiene que ver el service
    worker nuevo), `/manifest.webmanifest`, íconos de la PWA y el HTML.
- `frontend/scripts/cf-headers.test.ts` (nuevo): verifica esas reglas y que
  el service worker y el manifest no tengan caché.

**Medición:** `npm run cf:build` + `wrangler dev` (el runtime de Workers en
local, que aplica el `_headers`), misma build, cambiando sólo el `_headers`.
Segunda visita con la caché del navegador tibia, celular 390×844, CPU 4x,
4G lenta (150 ms RTT); 5 vueltas, mediana.

| visita repetida | Antes | Después |
|---|---:|---:|
| `/` estáticos que van a la red (revalidan) | 21 | 0 |
| `/` `load` | 977 ms | 499 ms |
| `/feed` estáticos que van a la red | 29 | 0 |
| `/feed` FCP / `load` | 596 / 904 ms | 264 / 347 ms |
| `/map` estáticos que van a la red | 34 | 0 |
| `/map` FCP / `load` | 680 / 1060 ms | 452 / 526 ms |

Cabeceras servidas por `wrangler dev` después del cambio: chunk de
`/_next/static` y `/maplibre/maplibre-gl-worker.mjs?v=6.15.0` con
`public, max-age=31536000, immutable`; `/landing/bar1.webp` y
`/logo-mark.svg` con un día; `/sw.js` y `/manifest.webmanifest` siguen en
`public, max-age=0, must-revalidate`.

**Queda abierto:** verificar en producción con
`curl -sI https://www.oido.com.ar/_next/static/chunks/<uno>.js` después del
deploy (desde la sesión el proxy no llega a `www.oido.com.ar`). El resto del
ítem 8 (preflights CORS, pedidos en paralelo a `auth/me`) va aparte.
