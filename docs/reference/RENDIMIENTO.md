# RENDIMIENTO.md — Cómo se mide y qué se midió

Regla: **ninguna optimización entra sin su número de antes y de después**,
medido con lo de esta página y en las mismas condiciones. Las tres
herramientas están en el repo; ninguna toca producción.

## Cómo se mide

### Frontend: `tools/perf/medir.mjs`

Playwright + CDP contra un `next start` local, con **toda la API simulada**
(ningún pedido sale del contenedor; el build apunta a la API de producción si
no se define `NEXT_PUBLIC_API_URL`, y el medidor corta todo host externo).
Ocho escenarios: landing, `/feed`, `/buscar`, `/my-shifts`, `/map`,
`/profile`, panel `/shifts` y `/shifts/new`. Por escenario, en frío:

- **bytes** de JS, CSS, fuentes e imágenes hasta el fin de la carga
  (transferidos y sin comprimir), y aparte lo que Next precarga después;
- **pedidos a la API** en la carga y cuántos se repiten;
- **FCP, LCP, TBT aproximado, CLS** y tiempo de script, con CPU ×4 y la red
  "mobile" de Lighthouse (150 ms de RTT, 1,6 Mb/s);
- **renders de React**: un gancho falso de React DevTools cuenta los
  componentes que se renderizaron en cada commit (mismo criterio que el
  Profiler). Tres fases: la carga, **10 s quietos** (lo que se renderiza sin
  que nadie toque nada es render innecesario) y una **interacción** por
  escenario (Disponible en el feed, filtros en buscar, pestañas del panel,
  tipear en publicar).

```bash
cd frontend && npm run build && (npx next start -p 3200 &)
node tools/perf/medir.mjs --base http://localhost:3200 --runs 3 --out antes.json
# … cambio, build, otra vez con --out despues.json
node tools/perf/medir.mjs --compare antes.json despues.json   # tabla markdown
```

- **Los tiempos sólo valen con la máquina quieta.** Con otros builds o tests
  corriendo, FCP/LCP/TBT se mueven cientos de ms. Para iterar, usá los números
  deterministas (bytes, renders, pedidos) con `--runs 1 --no-throttle`; el
  antes y el después que se reportan se miden uno detrás del otro, con dos
  builds hechos igual (uno de `main`, otro de la rama).
- **Nombres de componentes** en `topLoad`/`topIdle`/`topInter` del JSON:
  buildear con `npx next build --no-mangling` (si no, salen minificados).
- `MEDIR_DEBUG=1` muestra los errores de la página. **Mirá que la pantalla
  medida no sea la de error:** la primera versión del medidor usaba puestos
  que no existen (`cocina`, `bachero`), y feed, buscar, mapa y panel
  reventaban; los números de esa corrida no valen.

### Turnstile: `tools/perf/turnstile.mjs`

El tilde de Cloudflare al entrar. Con un build con la **clave de prueba**
pública de Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`,
siempre aprueba), mide desde la landing (3 s leyendo, tocar «Entrar») y
abriendo `/login` directo: cuándo se ve el formulario, cuándo terminó de
bajar el script, cuándo cargó el iframe y cuándo se habilita «Ingresar».
Este sí deja salir los pedidos a `challenges.cloudflare.com`.

### Backend: consultas por pedido y consultas lentas

- **N+1:** `backend/tests/test_rendimiento_consultas.py` siembra el mismo
  mundo con N=2 y N=10 (turnos, postulaciones, avisos, mensajes…) y exige que
  25 GET calientes hagan **la misma cantidad de consultas** con N=10 que con
  N=2. Con `-s` imprime la tabla. El contador (`count_queries`) está en
  `tests/conftest.py`.
- **Consultas lentas:** producción no sirve para esto en la beta (el
  2026-11-19 tenía 8 turnos y 12 usuarios; `pg_stat_statements` en Neon no
  mostraba nada de la app arriba de 4 ms). Se mide con volumen en el Postgres
  local de `tools/e2e-local/` (base aparte, migraciones de Alembic, ~20.000
  turnos, 5.000 trabajadores, 50.000 postulaciones, 100.000 avisos, 20.000
  mensajes) y `EXPLAIN (ANALYZE, BUFFERS)` del SQL de cada endpoint.

## Resultados del 2026-11-19

### Frontend (CPU ×4, red de celular, mediana de 3; `main` → esta rama)

Dos builds hechos igual (`main` en `8c1d22c` y la rama), medidos uno detrás
del otro con la máquina quieta. JS = lo transferido hasta el fin de la carga.

| Pantalla | JS (KB) | FCP (ms) | LCP (ms) | TBT (ms) | Renders al cargar | Commits al cargar | Renders en la interacción |
|---|---|---|---|---|---|---|---|
| Landing | 267 | 1.464 → 1.468 | 1.464 → 1.468 | 62 → 78 | 228 → 230 | 7 | – |
| `/feed` | 325 → 326 | 1.252 → 1.124 | 3.336 → 3.288 | 278 → 236 | 312 → 311 | 11 | 41 → 39 |
| `/buscar` | 325 → 326 | 1.128 → 1.132 | 3.048 → 3.016 | 363 → 350 | 948 | 10 → 11 | 198 |
| `/my-shifts` | 623 → 624 | 1.132 → 1.112 | 3.244 → 3.332 | 682 → 771 | 554 → 545 | 15 → 16 | – |
| `/map` | 625 → 626 | 1.136 → 1.352 | 1.136 → 1.352 | 616 → 697 | 2.214 → 2.026 | **66 → 20** | – |
| `/profile` | 325 → 326 | 1.096 → 1.088 | 2.760 → 2.788 | 147 → 176 | 231 | 9 → 10 | – |
| Panel `/shifts` | 322 | 1.140 → 1.120 | 3.232 → 3.184 | 400 → 393 | 573 → 572 | 11 → 10 | 781 → 777 |
| `/shifts/new` | 312 | 1.080 → 1.088 | 2.772 → 3.000 | 147 → 172 | **625 → 476** | 12 | **1.344 → 864** |

- **Renders quietos: 0 en todas las pantallas de la app, antes y después**
  (los 4 de la landing son la palabra que rota, a propósito). **Pedidos
  repetidos en la carga: ninguno**, antes y después.
- **Lo que bajó de verdad:** `/shifts/new` (−24 % de renders al cargar, −36 %
  al tipear) y `/map` (de 66 commits a 20 al abrir: el anillo del radio ya no
  re-renderiza React en cada cuadro).
- **Bytes: sin cambio.** Lo que se pasó a `next/dynamic` (recorrido, comparar,
  QR) pesaba 3 a 7 KB y no estaba en el camino de carga medido; la pantalla
  pesada (`/my-shifts`, `/map`: maplibre) queda abierta abajo.
- **Los tiempos se mueven dentro del ruido.** Medido aparte: con el MISMO
  build, de una corrida a otra (mediana de 3 cada una), el FCP de `/map`
  fue de 1.104 a 1.352 ms y el TBT de `/my-shifts` de 682 a 804 ms. Ninguna
  diferencia de la tabla pasa de eso; para afirmar una mejora de tiempo hace
  falta más que una corrida por lado.
- La interacción de cada escenario: tocar «Disponible» (feed), «Urgentes» y
  «Mejores pagos» (buscar), las cuatro pestañas (panel), tipear «Mozo para
  evento» (publicar).

### Turnstile (mediana de 5)

| Camino | Script listo | Iframe | Tilde («Ingresar» habilitado) |
|---|---|---|---|
| Landing → tocar «Entrar» | 1.304 → precargado | 1.796 → 1.072 ms | **4.454 → 3.744 ms** |
| `/login` directo | 3.412 → 1.588 ms | 3.940 → 3.282 ms | **6.577 → 6.107 ms** |

Lo que queda (~2,7 s desde el iframe) es la verificación de Cloudflare.

### Backend

- **N+1: no había.** Los 25 GET medidos ya hacían una cantidad fija de
  consultas (de 2 a 8). Quedó la guardia para que no vuelva.
- **Con volumen**, ninguna consulta de la app pasa de ~3 ms, salvo:

| Consulta | Antes | Después | Qué se hizo |
|---|---|---|---|
| Lista de chats (`/chats`, los dos roles) | 8,0 ms | 0,09 ms | el `OR` entre comercio y trabajador pasó a una unión de dos lecturas por índice |
| Ficha del admin (historial de un trabajador) | 2,8 ms | 0,17 ms | índice parcial `ix_shifts_last_no_show_worker_profile_id` (migración 0061) |
| «Ausencias de hoy» del admin | 2,6 ms | 0,07 ms | índice parcial `ix_shifts_no_show_at` (0061) |

- **Caché HTTP:** `GET /push/public-key` (igual para todos, sin sesión) lleva
  `Cache-Control: public, max-age=300`, como los planes públicos. El resto
  de los GET públicos depende del estado del turno (`/shifts/{id}/public`
  pasa a 410) o es personal: sin caché. GZip ya estaba.

## Lo que se probó y no entró

- **`LazyMotion` + `m.*`** para `motion`: no bajó bytes de carga (las
  funciones de animación se piden igual al hidratar) y con `domMax`
  sumaba 49 KB en `/feed`. `drag`/`layout` obligan a `domMax`.
- **Memoizar providers del layout raíz:** `ThemeProvider` ya memoiza,
  `ToastProvider` pasa una función estable y con 0 renders quietos no hay
  ganancia que medir.
- **Caché de datos en el cliente:** no; turnos, postulaciones y avisos
  cambian. Sí se deduplican los GET idénticos **en vuelo**
  (`lib/api.ts`, `getDeduplicado`): nada queda guardado después.

## Abierto (necesita una decisión, no es sólo código)

- **El mapa chico de Mis turnos baja maplibre (~1 MB sin comprimir).** Cada
  turno aceptado con dirección muestra un mapa, así que la librería se baja
  al abrir la pantalla: `/my-shifts` pesa el doble que las demás. Para no
  bajarla habría que mostrar el mapa al tocar, o una imagen estática.
- **`/matching/search`** filtra por radio y ordena en Python (~50 ms con
  5.000 trabajadores, 3 ms de SQL), sobre el punto desplazado a propósito
  (ADR-0014). Bajarlo a SQL toca esa regla de privacidad.
- **`/admin/stats`** tarda ~160 ms con volumen contra 20 ms de SQL: el
  tiempo está en Python. Sólo admin.
- **Sentry y Chrome DevTools** no estaban conectados en la sesión del
  2026-11-19; los errores de producción no se miraron.
