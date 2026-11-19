# Rendimiento medido: renders, bundle, pedidos, consultas y el tilde de Cloudflare

**Pedido:** Julieta pidió una pasada de rendimiento (renders innecesarios,
bundle con lazy loading, pedidos y caché, consultas lentas y N+1, imágenes,
fuentes y scripts), con la condición de **medir antes y después de cada
optimización**. En el camino contó que, al pasar de la landing a «Entrar», el
tilde de la verificación de Cloudflare tardaba en aparecer.

**Qué cambió:** lo que se nota es que **el tilde de Cloudflare sale 0,7 s
antes** al ir de la landing a «Entrar» y 0,5 s antes al abrir `/login`
directo. Lo demás no se ve; números y método en
[`reference/RENDIMIENTO.md`](../reference/RENDIMIENTO.md).

- **Medidores nuevos:** `tools/perf/medir.mjs` (bytes, pedidos, tiempos y
  renders de React por pantalla, con la API simulada) y
  `tools/perf/turnstile.mjs` (el tilde). En el backend,
  `tests/test_rendimiento_consultas.py` exige que 25 GET calientes hagan las
  mismas consultas con 2 y con 10 filas (guardia contra N+1), con
  `count_queries` compartido en `tests/conftest.py`.
- **Turnstile:** el botón «Ingresar» espera el token, y el script empezaba a
  bajar recién con el formulario a la vista. Ahora la landing lo baja cuando
  ya cargó y el navegador está libre, o apenas se apunta a «Entrar» o «Crear
  cuenta» (`components/landing/PrecargaIngreso.tsx`), y `/login` y
  `/register` lo piden en el HTML (`TurnstileTemprano` en
  `components/TurnstileWidget.tsx`). El cargador quedó en `lib/turnstile.ts`.
  Sólo baja `api.js`: sin dibujar el widget no hay verificación ni cookies.
- **Renders:** el anillo de radio del mapa (`components/map/RadiusRing.tsx`)
  animaba con un `setState` por cuadro (≈50 commits al abrir `/map`); ahora
  escribe directo en la fuente del mapa. En `/shifts/new` la grilla de
  puestos (`RejillaPuestos`) no se redibuja al tipear. Los relojes de 30 s
  (`lib/use-now.ts`) no corren con la pestaña oculta y `ShiftActions` sólo lo
  prende en turnos confirmados o en camino.
- **Pedidos:** los GET idénticos en vuelo comparten un solo `fetch`
  (`getDeduplicado` en `lib/api.ts`); nada queda guardado y cualquier
  mutación los suelta.
- **Bundle:** el recorrido guiado (`lib/use-tour-pendiente.ts`), el modal de
  comparar turnos y el QR del admin se cargan aparte con `next/dynamic`.
  Fotos de tamaño fijo con `width`/`height`.
- **Backend:** la lista de chats pasó de un `OR` a una unión de dos lecturas
  por índice (8 ms → 0,09 ms con volumen,
  `chat/infrastructure/repositories.py`); migración `0060` con dos índices
  parciales de ausencias en `shifts`; `Cache-Control` público en
  `/push/public-key`.

**Por qué así:** se midió primero y se tocó sólo lo que el número mostraba.
Descartado con medición: `LazyMotion` (no bajaba bytes; con `domMax`,
+49 KB en `/feed`), memoizar los providers del layout (0 renders quietos, no
había qué ganar) y caché de datos en el cliente (los datos cambian). No hubo
N+1 que arreglar: los GET ya hacían una cantidad fija de consultas. La
primera línea base del medidor usaba puestos inválidos y medía la pantalla de
error en cuatro escenarios; se corrigió y el antes y el después finales se
midieron con el medidor ya arreglado.

**Queda abierto:** el mapa chico de Mis turnos baja maplibre (~1 MB) al
abrir la pantalla (decisión de producto: mapa al tocar o imagen estática);
`/matching/search` filtra en Python sobre el punto desplazado (ADR-0014);
`/admin/stats` gasta el tiempo en Python. Sentry no estaba conectado en la
sesión: falta mirar errores de producción. Anotado en `STATUS.md`.
