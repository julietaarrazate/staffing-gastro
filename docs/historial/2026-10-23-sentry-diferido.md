# Sentry del navegador: más chico y después de cargar la página

**Pedido:** Julieta, 2026-10-22: reducir el bundle con lazy loading y
optimizar scripts, midiendo antes y después.

**Qué cambió:** el SDK de Sentry del navegador arrancaba junto con la
hidratación y traía el paquete entero (Replay, Feedback, tracing), ~534 KB sin
comprimir en todas las rutas. Ahora:

- `frontend/lib/sentry-client.ts` nombra sólo lo que se usa (`init`,
  `captureException`, `captureRouterTransitionStart`), así el bundler deja
  afuera el resto.
- `frontend/instrumentation-client.ts` lo carga con `import()` después del
  evento `load`, cuando el navegador queda libre (`requestIdleCallback`, con
  tope de 4 s). Los errores que pasen antes se guardan y se mandan apenas
  Sentry arranca. Verificado con un DSN falso: llegan tanto un error tirado
  antes del `load` como uno posterior.

**Medición** (scripts del relevamiento; build de producción con DSN de
Sentry, API simulada a 80 ms, celular 390x844 con CPU 4x y 4G lenta, mediana
de 3; "antes" es `main` del mismo día, con los arreglos del mapa y del feed ya
mergeados):

| | Antes | Después |
|---|---|---|
| Chunk de Sentry (gzip) | 173 KB | 75 KB |
| JS `/` | 435 KB | 336 KB |
| JS `/feed` | 492 KB | 393 KB |
| JS `/turno` | 740 KB | 641 KB |
| `/` listo (h1 visible) | 4,33 s | 2,77 s |
| `/feed` listo (turno visible) | 4,53 s | 4,28 s |
| `/turno` listo (h1 visible) | 5,87 s | 2,85 s |
| TBT `/` · `/feed` · `/turno` | 328 · 727 · 629 ms | 191 · 605 · 460 ms |

El LCP quedó igual (±5 %, dentro del ruido entre corridas): lo que mejora es
cuánto tarda en estar listo y respondiendo.

**Queda abierto:** las transiciones de página anteriores al arranque de
Sentry no se registran (antes tampoco había tracing).
