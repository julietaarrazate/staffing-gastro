# PERFORMANCE_AUDIT_FRONTEND.md — Auditoría de performance del frontend

> Auditoría acotada al **frontend** (`frontend/`), basada en lectura directa
> del código y en un `next build` real (medido el 2026-07-03, Next.js
> 16.2.9 / Turbopack). Cada hallazgo cita `archivo:línea`. Complementa —y en
> la parte de mapas **actualiza**— [PERFORMANCE_REPORT.md §3](./PERFORMANCE_REPORT.md#3-frontend),
> que fue escrito cuando el mapa todavía usaba Leaflet/react-leaflet; hoy usa
> MapLibre GL vía `@vis.gl/react-maplibre` (ver [MAPS_REDESIGN.md](./MAPS_REDESIGN.md),
> ADR-0001). No se tocó `backend/`.
>
> Convención de severidad: 🔴 alto impacto/toda ruta · 🟠 impacto medio o
> acotado a rutas específicas · 🟡 bajo impacto o cosmético. ✅ = quick win
> aplicado en este PR. Sin ✅ = recomendación para que decida Julieta (esfuerzo
> y riesgo detallados).
>
> **Actualización 2026-07-03 (PR de optimizaciones aprobadas):** se
> implementaron los hallazgos 1 (Sentry lazy-load), 4 (`prefers-reduced-motion`
> en los componentes de mayor movimiento) y 5 (memo + handler estable en
> marcadores de mapa). El hallazgo 2 (`whileTap` de Button/Card/Chip a CSS) se
> mantiene sin tocar por decisión explícita — no se cambia la sensación táctil
> de los botones. Detalle de cada uno en sus secciones abajo.

## Nota metodológica sobre el bundle

Next.js 16 (tanto con Turbopack como con `--webpack`) **ya no imprime la
tabla "Route / First Load JS"** en la salida de `next build` (se verificó con
`npm run build`, `npx next build --webpack` y `npx next build
--experimental-analyze`: los tres terminan en la lista de rutas sin columna de
tamaño). Los tamaños de esta auditoría se obtuvieron reconstruyendo el build
con `--webpack` (nombres de chunk estables, `.next/server/app/<ruta>.html`)
y sumando el peso real (gzip) de los `<script src>` que cada HTML prerenderizado
efectivamente referencia — es decir, el JS que el navegador pide en la carga
inicial de esa ruta, no un estimado.

## Resumen ejecutivo

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | `@sentry/nextjs` se importa entero (namespace) en todas las rutas: ~138 KB gzip en el 100% de las páginas | 🔴 | ✅ Aplicado — import dinámico, gateado por DSN |
| 2 | `motion` (Button/Card/Chip/Sheet/Modal/Toast/...) va en el bundle de **todas** las rutas por un `whileTap` de botón: ~40 KB gzip siempre | 🟠 | Recomendación (sin tocar por decisión: no se cambia el `whileTap`) |
| 3 | `maplibre-gl` (266 KB gzip) está correctamente code-splitteado — no aparece en ninguna ruta que no sea mapa | 🟢 | Ya está bien (verificado) |
| 4 | Casi ningún componente que usa `motion` respeta `prefers-reduced-motion` (sólo 1 de 13 archivos) | 🟠 | ✅ Aplicado (8 de los 12 restantes — ver §4.1) |
| 5 | Marcadores de mapa (`WorkerMarker`/`ShiftMarker`/`ClusterMarker`) se re-renderizan todos al seleccionar uno solo | 🟡 | ✅ Aplicado — `React.memo` + `onClick(id)` estable |
| 6 | `WorkerSearchMap`: filtro de `workers` recalculado en cada render, incluso al tocar un marcador | 🟡 | ✅ Aplicado |
| 7 | `ImageUpload.tsx`: preview sin `loading="lazy"`/`decoding="async"` (inconsistente con el resto de la app) | 🟡 | ✅ Aplicado |
| 8 | Imágenes (`<img>` crudo) sin `next/image`, sin `images.remotePatterns` | 🟡 | Recomendación (ya documentado en TECH_DEBT.md F4) |
| 9 | `useWebSocket` con backoff exponencial + cleanup correcto | 🟢 | Ya está bien (verificado) |
| 10 | Fuentes vía `next/font/google` (self-hosted, sin bloqueo) y sin `@import` CSS externo | 🟢 | Ya está bien (verificado) |

---

## 1. Bundle por ruta

### 1.1 Tabla real (First Load JS, gzip, medido)

> Tabla original de la auditoría (**antes** del fix de Sentry, ver §1.3 para
> el número actualizado post-fix). Se deja como referencia de la composición
> del piso compartido; el número vigente de `/login` hoy es ~224 KB, no
> ~291 KB — la diferencia es exactamente el chunk de Sentry.

| Ruta | Peso inicial (gzip) | Chunks |
|---|---|---|
| `/`, `/admin`, `/chats`, `/login`, `/register`, `/_not-found` | ~291 KB (antes del fix de §1.3; hoy ~224 KB, medido en `/login`) | 9 |
| `/feed`, `/map`, `/search` | ~294 KB (antes del fix de §1.3) | 10 |
| `/profile`, `/shifts/new` | ~297 KB (antes del fix de §1.3) | 10 |
| `/my-shifts`, `/shifts` | ~298 KB (antes del fix de §1.3) | 11 |

Composición del piso compartido (~291 KB, presente en el 100% de las rutas,
**antes** del fix de Sentry — ver §1.3):

| Chunk (contenido) | Tamaño (gzip) |
|---|---|
| Sentry (`@sentry/nextjs`) | ~138 KB — ✅ ya no está en el piso compartido (§1.3) |
| React + React-DOM (framework + runtime) | ~119 KB |
| `motion` (framer-motion) | ~40 KB |
| Next.js runtime/polyfills | resto |

**maplibre-gl (266 KB gzip) NO está en esta lista** — confirmado que no
aparece en el HTML prerenderizado de ninguna ruta. Ver §1.2.

La variación entre rutas (291 → 298 KB) es mínima y corresponde a código
propio de cada página, no a librerías — es decir, **no hay una ruta
anormalmente pesada**; el problema es el piso compartido, no una ruta
puntual.

### 1.2 Code-splitting del mapa: verificado, está bien

`frontend/components/ShiftCard.tsx:9`, `frontend/app/search/page.tsx:15` y
`frontend/app/map/page.tsx:17` cargan `MiniMap`/`WorkerSearchMap`/`ShiftMap`
con `dynamic(..., { ssr: false })`. Los únicos módulos que importan
`maplibre-gl`/`@vis.gl/react-maplibre` en tiempo de ejecución
(`components/map/MapView.tsx:5,8`, `ClusterMarker.tsx:3`, `ShiftMarker.tsx:3`,
`WorkerMarker.tsx:4`, `UserPuck.tsx:3`, `RadiusRing.tsx:4`,
`worker/ShiftMap.tsx`) sólo se alcanzan **a través** de esos tres puntos de
entrada dinámicos — no hay ningún import estático de `maplibre-gl` fuera de
`components/map/`. Confirmado con `grep` y con el análisis del bundle: el
chunk de maplibre (266 KB gzip) no aparece en el `<script>` de ninguna ruta
que no sea `/map`, `/search`, ni en las que usan `ShiftCard`/`MiniMap`
(`/shifts`, `/my-shifts`) — y en esas, se carga como chunk aparte vía
`import()`, no en el bundle inicial. **No requiere cambios.**

### 1.3 🔴✅ Sentry se importaba entero en cada ruta — aplicado: import dinámico gateado por DSN

**Aplicado en este PR.** `frontend/instrumentation-client.ts` e
`instrumentation.ts` hacían `import * as Sentry from "@sentry/nextjs"` a
nivel de módulo. `instrumentation-client.ts` es un archivo especial de
Next.js: se carga en **todas** las rutas automáticamente, sin importar si el
componente de esa página usa algo de Sentry. El `Sentry.init` ya estaba
gateado por `if (dsn)` en runtime, pero **no en bundle size**: el `import`
estático de todo el SDK se resolvía en build time, antes de saber si había
DSN, así que el paquete completo viajaba en el bundle inicial de cada página
tuviera o no sentido ahí.

**Cambio:** en ambos archivos, el `import * as Sentry` estático se reemplazó
por `await import("@sentry/nextjs")` **dentro** del `if (dsn)` — el SDK sólo
se pide a la red si `NEXT_PUBLIC_SENTRY_DSN` está configurada. Los dos
exports que Next.js requiere de forma síncrona
(`onRouterTransitionStart` en el cliente, `onRequestError` en el servidor)
siguen existiendo siempre (Next los necesita al cargar el módulo), pero ahora
son wrappers livianos: sin DSN son no-ops; con DSN, hacen el `import()` lazy
(cacheado por el motor de módulos, así que sólo se pide una vez) y delegan a
la función real de Sentry. No se tocó `next.config.ts` (se evaluó
`withSentryConfig`, pero el import dinámico manual ya resuelve el problema de
bundle sin agregar el plugin).

- **Verificado — no rompe con DSN real:**
  `NEXT_PUBLIC_SENTRY_DSN="https://abc123@o12345.ingest.sentry.io/1" npm run
  build` compila limpio (`✓ Compiled successfully`, mismo set de rutas), o
  sea que la lógica `if (dsn) { ... }` sigue intacta y el `import()` no tiene
  errores de tipos ni de resolución.
- **Verificado — sin DSN (caso actual en producción hoy) el chunk de Sentry
  ya NO viaja en el bundle inicial de ninguna ruta.** Medido reconstruyendo
  con `--webpack` (misma metodología del resto de esta auditoría) y sumando
  el gzip real de los `<script src>` que referencia
  `.next/server/app/login.html`:

  | | Antes (import estático) | Después (import dinámico) | Diferencia |
  |---|---|---|---|
  | JS inicial de `/login` (gzip, suma de `<script>`) | 309 020 B (~302 KB) | 229 531 B (~224 KB) | **−79 489 B (~−78 KB, −25.7%)** |

  El chunk que desaparece de la lista de `<script>` es exactamente el de
  Sentry: en el build "antes", `462-62d9035362950ae4.js` (141 924 B gzip,
  contiene el string `sentry` 7 veces) está en el HTML de `/login`; en el
  build "después", no hay ningún chunk con `sentry` en el contenido
  referenciado por ninguna ruta (`grep -rl sentry .next/static/chunks/`
  encuentra el SDK completo compilado en 4 archivos de chunk — existen en
  disco porque webpack siempre emite el chunk de un `import()` aunque el
  código sea inalcanzable en runtime con DSN vacío — pero
  `grep -rl <esos-chunks> .next/server/app/*.html` no devuelve **ningún**
  archivo: ninguna ruta los referencia en su `<script src>`, así que el
  navegador nunca los pide).
- **Esfuerzo real:** bajo (dos archivos, ~10 líneas cada uno). **Riesgo:**
  bajo — la lógica `if (dsn)` es la misma, sólo se retrasó el `import` del
  paquete a después de esa condición; no se verificó con un DSN real
  reportando a un proyecto Sentry real (no hay credenciales en este entorno),
  pero el build con DSN falso compila y el flujo de tipos/exports es
  idéntico al de antes.

### 1.4 🟠 `motion` va en el bundle de cada ruta por el botón del Design System (recomendación, no aplicado)

`motion` se importa en 14 archivos: `components/ui/Button.tsx:3`,
`Card.tsx:3`, `Chip.tsx:3`, `EmptyState.tsx:3`, `FAB.tsx:4`, `Modal.tsx:3`,
`SegmentedControl.tsx:4`, `Sheet.tsx:3`, `Toast.tsx:3`,
`components/SplashScreen.tsx`, `components/worker/MapSheet.tsx`,
`components/worker/SwipeDeck.tsx` y `app/page.tsx:6`. La razón de que esté en
**todas** las rutas (no sólo `/feed`, donde vive el swipe) es
`components/ui/Button.tsx:57,62`: el `<Button>` del Design System —usado en
prácticamente toda la app— es un `motion.button` con
`whileTap={{ scale: 0.96 }}` sólo para el efecto de "apachado" al tocar.
Lo mismo en `Card.tsx:24`, `Chip.tsx:22` y varios más: micro-interacciones que
podrían resolverse con CSS puro (`active:scale-95 transition-transform`, ya
usado en otros lados del código, ej. `components/ImageUpload.tsx:46`) a costo
cero de JS.

- **Impacto:** medio-alto — ~40 KB gzip en el 100% de las rutas por un efecto
  visual que Tailwind ya resuelve sin JS en otras partes del mismo código.
- **Por qué no es quick win:** cambiar `motion.button`/`whileTap` (spring
  físico con `stiffness`/`damping`) por `active:scale-95` de Tailwind
  (transición CSS lineal/ease) **es un cambio de comportamiento visible**,
  aunque sutil — distinta curva de animación, distinto trigger (`:active` de
  CSS no dispara igual que el gesto de Framer en touch en todos los
  navegadores). El enunciado pide explícitamente no tocar nada que cambie
  comportamiento visible sin que Julieta decida.
- **Recomendación concreta:** evaluar reemplazar el `whileTap` de `Button`,
  `Card` y `Chip` (los tres de mayor uso) por `active:scale-95
  transition-transform duration-150` de Tailwind, y dejar `motion` sólo donde
  aporta algo que CSS no puede (drag del `SwipeDeck`, springs con
  `dragElastic`/`dragMomentum` del `MapSheet`). Ahorro estimado: ~40 KB gzip
  en cada ruta que no usa `/feed` ni `/map` (la mayoría). Requiere revisión
  visual/UX antes de aplicar.
- **Esfuerzo:** bajo-medio (3 componentes). **Riesgo:** bajo, pero es un
  cambio de sensación táctil que Julieta debería aprobar.

---

## 2. Imágenes

### 2.1 Estado real: mejor de lo que sugería la auditoría anterior

`docs/PERFORMANCE_REPORT.md §3.2` (previa a la migración a MapLibre) decía
que sólo había `loading="lazy"` "manual" sin más detalle. Al revisar cada uso
de `<img>` hoy (`components/ui/Avatar.tsx:41-48`,
`components/map/WorkerMarker.tsx:72-79`,
`components/worker/OpportunityCard.tsx:32-39`, `app/chats/page.tsx:60-66`,
`app/companies/[id]/page.tsx:46-52`, `app/search/page.tsx:129-135`,
`app/workers/[id]/page.tsx:41`), **todos ya tenían `loading="lazy"` +
`decoding="async"`**, y todos están dentro de contenedores con tamaño fijo en
CSS (`h-12 w-12`, `h-16 w-16`, `h-56 w-full`, etc.), así que no hay CLS real:
el contenedor reserva el espacio independientemente de si la imagen cargó.

### 2.2 🟡 ✅ Único faltante encontrado: `ImageUpload.tsx`

`components/ImageUpload.tsx:49` (preview de foto de perfil/logo en el
formulario) era el único `<img>` del código sin `loading="lazy"` ni
`decoding="async"`, inconsistente con el resto de la app. **Aplicado**:
se agregaron ambos atributos, sin tocar el layout (el contenedor ya tiene
tamaño fijo `h-24 w-24`, línea 46). Impacto real bajo (imagen única, casi
siempre visible de entrada en el formulario), se corrige por consistencia.

### 2.3 🟡 `next/image` — recomendación, no aplicado

`next.config.ts` no declara `images.remotePatterns`, y las fotos demo vienen
de dominios variables (`loremflickr.com`, `i.pravatar.cc`) más Cloudinary en
producción. Migrar a `next/image` traería resize automático + `srcset`
responsivo, pero:

- Requiere listar cada host externo en `images.remotePatterns` de
  `next.config.ts` (loremflickr, pravatar, res.cloudinary.com).
- La CSP actual (`next.config.ts:33`, línea `img-src 'self' data: blob:
  https:`) ya permite cualquier host `https:`, así que no bloquea `next/image`
  hoy — pero endurecer la CSP más adelante (el propio comentario en
  `next.config.ts:23` lo prevé: *"al pasar a Cloudinary propio (R2.5)
  se puede endurecer"*) sí podría chocar si no se coordina con la lista de
  `remotePatterns`.
- Ya está documentado como deuda en `docs/TECH_DEBT.md F4`; esta auditoría no
  agrega nada nuevo salvo confirmar que el punto sigue abierto y que no hay
  CLS activo hoy (§2.1), así que la prioridad real es más baja que "F4"
  sugiere por sí solo.
- **Esfuerzo:** medio (7 usos + config). **Riesgo:** bajo-medio (depende de
  que Cloudinary/loremflickr/pravatar sigan respondiendo con los tamaños que
  `next/image` pida).

---

## 3. Re-renders de listas

### 3.1 🟡 ✅ `WorkerSearchMap`: filtro recalculado en cada render

`components/WorkerSearchMap.tsx` (antes de este PR, línea ~32) hacía
`workers.filter(...)` directo en el cuerpo del componente. Como el
`onClick` de cada `WorkerMarker` llama a `toggle()` → `setSelectedId()`
(`WorkerSearchMap.tsx:69`), **cada tap sobre un marcador** volvía a recorrer
y filtrar la lista completa de `workers`, aunque `workers` no hubiera
cambiado. **Aplicado:** se envolvió el filtro en `useMemo(() => ...,
[workers])` (`components/WorkerSearchMap.tsx:35-42`). Impacto real bajo con
los volúmenes actuales (decenas de resultados), pero es gratis y correcto.

### 3.2 🟡✅ Marcadores de mapa: re-render de todos al seleccionar uno — aplicado

**Aplicado en este PR.** Antes, `WorkerSearchMap.tsx:69` y
`worker/ShiftMap.tsx:126,140` pasaban `onClick={() => toggle(worker.profile_id)}`
/ `onClick={() => onSelect(shiftId)}` — una función **nueva en cada render**
del padre — a `WorkerMarker`/`ShiftMarker`/`ClusterMarker`, ninguno de los
cuales usaba `React.memo`. Resultado: al tocar un marcador para
seleccionarlo, el padre re-renderizaba y **todos** los marcadores de la lista
se re-renderizaban, no sólo el que cambió de estado `active`.

**Cambio:** se cambió la firma de `onClick` de los 3 componentes de
`() => void` a `(id: string) => void` (`ClusterMarker` recibe
`(clusterId, longitude, latitude)`, ya que el handler de expansión de zoom
los necesita), cada marcador ahora llama a `onClick(id)`/`onClick(clusterId,
longitude, latitude)` usando sus propias props en vez de una closure externa,
y los 3 (`components/map/WorkerMarker.tsx`, `ShiftMarker.tsx`,
`ClusterMarker.tsx`) se envolvieron en `React.memo`. En los padres:

- `components/WorkerSearchMap.tsx`: `toggle` pasó de función declarada en el
  cuerpo del componente a `useCallback(..., [])`, y se pasa directo como
  `onClick={toggle}` (antes: `onClick={() => toggle(worker.profile_id)}`).
- `components/worker/ShiftMap.tsx`: se agregó `handleShiftSelect =
  useCallback((id) => onSelect(id), [onSelect])` para `ShiftMarker`, y
  `handleClusterClick` (ya era `useCallback`) se pasa directo a
  `ClusterMarker` sin wrapping adicional.
- `app/map/page.tsx`: **cambio adicional no listado originalmente en esta
  sección**, pero necesario para que la memoización sea efectiva en el caso
  real de uso — `selectById` (el `onSelect` que `ShiftMap` recibe del padre)
  era una función declarada en el cuerpo del componente, redefinida en cada
  render de `MapPage`. Como `MapPage` re-renderiza exactamente cuando cambia
  la selección (setActiveIndex), pasar un `onSelect` nuevo en ese mismo
  render habría invalidado el memo justo en el caso que se quería optimizar.
  Se convirtió a `useCallback((id) => ..., [shifts])`, estable mientras la
  lista de turnos no cambie.

**Resultado:** al cambiar `selectedId`/`activeId`, sólo re-renderizan el
marcador que sale y el que entra de `active` (sus props cambiaron); el resto
recibe las mismas props por referencia (`onClick` estable + `id`/posición/
`active=false` sin cambios) y `React.memo` evita el re-render. Sin cambio de
comportamiento visible — verificado con la suite de Playwright (drag, tap y
selección de marcadores siguen funcionando) y revisión manual del diff.

### 3.3 Resto de listas: revisadas, sin acción necesaria

- **`SwipeDeck`** (`components/worker/SwipeDeck.tsx`): usa
  `useMotionValue`/`useTransform` para `x`/`rotate`/opacidades — estos NO
  disparan re-render de React al cambiar (es la razón de ser de
  `MotionValue`), así que el drag del swipe ya es eficiente por diseño de la
  librería, sin necesidad de memo adicional.
- **`/search`, `/chats`, `/my-shifts`, `/shifts`, `NotificationBell`,
  `shifts/[id]/candidates`**: se revisaron uno por uno
  (`app/search/page.tsx:122-167`, `app/chats/page.tsx:53-89`,
  `app/my-shifts/page.tsx`, `app/shifts/page.tsx:131-195`,
  `components/NotificationBell.tsx:85-96`,
  `app/shifts/[id]/candidates/page.tsx:102-147`). Todos pasan `children`
  JSX y/o handlers inline (`onClick={() => assign(...)}`) como props a las
  cards de lista (`ShiftCard`, `CandidateCard`), lo que anula cualquier
  beneficio de envolver esas cards en `React.memo` sin antes rediseñar el
  patrón de children-as-render-prop — un refactor de arquitectura, no un
  quick win. Con los volúmenes reales de la app (postulantes de un turno,
  turnos propios, conversaciones — decenas, no miles) el costo de
  re-renderizar la lista completa es marginal; no se encontró evidencia de
  que valga la pena ese refactor hoy.
- **No hay cálculos costosos sin memoizar en el feed**: se buscó
  específicamente lógica de distancia/orden del lado del cliente
  (`haversine`, `.sort(`) fuera de `components/worker/ShiftMap.tsx`, que
  **ya** memoiza todo correctamente (`clusterIndex`, `clusters`,
  `orderedClusters` con `useMemo`, líneas 79-95) — es el único lugar del
  código que hace este tipo de cálculo, y ya está bien hecho.

---

## 4. Otros

### 4.1 🟠✅ `prefers-reduced-motion`: cubierto para CSS y ahora también para `motion` en los componentes de mayor movimiento

`app/globals.css:110-119` tiene una regla global `@media
(prefers-reduced-motion: reduce)` que fuerza `animation-duration`/
`transition-duration` a `0.01ms` — cubre las animaciones **CSS** del mapa
(`markerPop`, `markerHalo`, `urgentPulse`, `puckHalo`). Pero eso **no cubre
`motion`** (Framer Motion anima con estilos inline vía WAAPI/rAF, no con las
propiedades CSS `animation`/`transition` que la regla `!important`
sobreescribe). Antes de este PR, `components/worker/MapSheet.tsx` era el
**único** de los 13 archivos con `motion` que llamaba a `useReducedMotion()`.

**Aplicado en este PR** (8 archivos, priorizando los de mayor movimiento o
que están en el patrón "lista/transición/entrada" mencionado en el pedido):

| Archivo | Qué se gateó |
|---|---|
| `components/SplashScreen.tsx` | Anillos `repeat: Infinity` (se **omiten** por completo, no sólo se acortan — es la animación con más movimiento continuo de toda la app), spring del logo, slides del logo/título/subtítulo, exit del overlay |
| `app/page.tsx` | Glow de fondo `repeat: Infinity` del hero (se omite), `Reveal` (fade+slide al entrar en viewport, usado 9 veces en la landing), entrada del hero y del logo |
| `components/ui/Toast.tsx` | Entrada/salida del toast (spring `y`+`scale`) |
| `components/ui/Sheet.tsx` | Entrada/salida del panel (spring `y: 100% → 0`) y fade del backdrop — el `drag="y"` para cerrar arrastrando queda intacto (es gesto del usuario, no animación automática) |
| `components/ui/Modal.tsx` | Entrada/salida del diálogo (spring `scale`+`y`) y fade del backdrop |
| `components/ui/EmptyState.tsx` | Fade+slide al montar |
| `components/worker/SwipeDeck.tsx` | Transición de la tarjeta al decidir like/pass (`controls.start`, duración 0.28s → 0 con motion reducido); el `drag="x"` del swipe en sí **no** se tocó — es la interacción central de `/feed` y deshabilitarla sería un cambio de UX mayor, fuera de alcance |
| `app/shifts/new/page.tsx` | Transición entre pasos del wizard de publicar turno (no estaba en la lista original de 13 archivos de la auditoría — se encontró al revisar, mismo patrón de "transición de lista de pasos", se gateó igual) |

Patrón usado en todos: `const reducedMotion = useReducedMotion()`, luego
`initial={reducedMotion ? false : {...}}` (arranca directo en el estado
final, sin animar la entrada) y `transition={reducedMotion ? { duration: 0 }
: {...}}` para animaciones `repeat: Infinity` se optó por **no renderizar**
el elemento en vez de sólo poner `duration: 0` (un `repeat: Infinity` con
duración 0 técnicamente sigue "corriendo").

**Deliberadamente sin tocar** (por instrucción explícita — no se cambia el
`whileTap`/comportamiento táctil de los botones):
`components/ui/Button.tsx`, `Card.tsx`, `Chip.tsx`, `FAB.tsx`,
`SegmentedControl.tsx` — los 5 restantes de los 13 originales. Todos usan
`motion` sólo para micro-interacciones (`whileTap`, `layoutId`) de
disparo único y corta duración (<0.3s), no para animaciones continuas o de
entrada; el riesgo de accesibilidad es bajo comparado con los 8 aplicados.
Sigue siendo la recomendación pendiente si se decide revisar en otro PR.

- **Sin cambio visible para quien NO tiene "reducir movimiento" activado**:
  se preservaron los mismos `initial`/`animate`/`exit`/`transition` para el
  caso `reducedMotion === false`; sólo cambia la rama `true`. Verificado con
  `tsc --noEmit`, `next build` y la suite de Playwright (3/3) sin
  regresiones — Playwright corre sin `prefers-reduced-motion` emulado, así
  que ejercita exactamente la rama sin cambios.

### 4.2 🟢 `useWebSocket`: backoff y cleanup correctos, sin cambios

`lib/useWebSocket.ts:44-48` implementa backoff exponencial real
(`1000 * 2 ** attempt`, tope `MAX_RETRY_DELAY_MS = 15_000`,
`useWebSocket.ts:9`) y el cleanup (`useWebSocket.ts:55-59`) cubre los tres
casos: bandera `closedByCleanup` para no reconectar tras un cierre
intencional, `clearTimeout` del retry pendiente, y `socket.close()`. Bien
implementado, no requiere cambios.

### 4.3 🟢 Fuentes: `next/font`, sin bloqueo

`app/layout.tsx:2,10-18` usa `next/font/google` (`Geist`, `Geist_Mono`), que
Next self-hostea en build time — sin request a Google Fonts en runtime, sin
FOIT/FOUC. `app/globals.css:1` sólo tiene `@import "tailwindcss"`, que
Tailwind v4 resuelve en build (no es un `@import` de red bloqueante). No hay
nada que optimizar acá.

### 4.4 Intervalos: revisados, con cleanup

`lib/auth-context.tsx:88-89` (`setInterval` de refresh de token) tiene
`clearInterval` en el cleanup del `useEffect`. `components/ui/Toast.tsx:29-31`
usa un `setTimeout` suelto (sin `clearTimeout` si el toast se descarta antes
de los 3.2s) — impacto nulo en la práctica (sólo hace un `setToasts` que
React ignora sin error si el provider sigue montado, que es siempre el caso:
vive en el `layout.tsx` raíz) — no amerita cambio.

---

## Quick wins aplicados en este PR (auditoría inicial)

1. ✅ `components/ImageUpload.tsx:49-55` — agregado `loading="lazy"
   decoding="async"` al preview de imagen (consistencia con el resto de la
   app, sin cambio de layout).
2. ✅ `components/WorkerSearchMap.tsx:35-42` — el filtro de `workers` con
   coordenadas ahora usa `useMemo([workers])` en vez de recalcularse en cada
   render (incluido cada tap de selección de marcador).

Ambos son cambios de una función pura/atributos HTML sin efecto visible;
verificados con `tsc --noEmit`, `next build` y la suite de Playwright (3/3)
sin regresiones.

## Optimizaciones aplicadas en el PR de seguimiento (2026-07-03)

3. ✅ **§1.3** — Sentry con import dinámico gateado por
   `NEXT_PUBLIC_SENTRY_DSN`. `/login` pasó de 309 020 B a 229 531 B gzip de
   JS inicial (−78 KB, −25.7%), medido reconstruyendo con `--webpack`.
4. ✅ **§3.2** — `React.memo` + `onClick(id)` estable en
   `WorkerMarker`/`ShiftMarker`/`ClusterMarker`; al seleccionar un marcador
   ya no re-renderizan los N, sólo el que sale y el que entra de `active`.
5. ✅ **§4.1** — `useReducedMotion()` en 8 archivos (`SplashScreen.tsx`,
   `app/page.tsx`, `Toast.tsx`, `Sheet.tsx`, `Modal.tsx`, `EmptyState.tsx`,
   `SwipeDeck.tsx`, `app/shifts/new/page.tsx`) para respetar "reducir
   movimiento" del sistema operativo/navegador.

Los tres verificados con `tsc --noEmit`, `next build` (sin y con
`NEXT_PUBLIC_SENTRY_DSN`) y la suite de Playwright (3/3), sin regresiones.
No se tocó el `whileTap`/spring de `Button`/`Card`/`Chip` — decisión
explícita, se mantiene la sensación táctil actual.

## Recomendaciones para decidir (no aplicadas)

| # | Qué | Esfuerzo | Riesgo |
|---|---|---|---|
| 1.4 | `whileTap` de Button/Card/Chip a CSS puro (`active:scale-95`) | Bajo-medio | Bajo (cambia sensación táctil) — decisión tomada de no aplicar |
| 2.3 | Migrar `<img>` a `next/image` + `images.remotePatterns` | Medio | Bajo-medio |
| 4.1 (resto) | `useReducedMotion()` en `Button.tsx`/`Card.tsx`/`Chip.tsx`/`FAB.tsx`/`SegmentedControl.tsx` (micro-interacciones, menor prioridad) | Bajo | Bajo |
