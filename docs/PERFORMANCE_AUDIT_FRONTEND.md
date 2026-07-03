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
| 1 | `@sentry/nextjs` se importa entero (namespace) en todas las rutas: ~138 KB gzip en el 100% de las páginas | 🔴 | Recomendación |
| 2 | `motion` (Button/Card/Chip/Sheet/Modal/Toast/...) va en el bundle de **todas** las rutas por un `whileTap` de botón: ~40 KB gzip siempre | 🟠 | Recomendación |
| 3 | `maplibre-gl` (266 KB gzip) está correctamente code-splitteado — no aparece en ninguna ruta que no sea mapa | 🟢 | Ya está bien (verificado) |
| 4 | Casi ningún componente que usa `motion` respeta `prefers-reduced-motion` (sólo 1 de 13 archivos) | 🟠 | Recomendación |
| 5 | Marcadores de mapa (`WorkerMarker`/`ShiftMarker`/`ClusterMarker`) se re-renderizan todos al seleccionar uno solo | 🟡 | Recomendación (memo solo no alcanza) |
| 6 | `WorkerSearchMap`: filtro de `workers` recalculado en cada render, incluso al tocar un marcador | 🟡 | ✅ Aplicado |
| 7 | `ImageUpload.tsx`: preview sin `loading="lazy"`/`decoding="async"` (inconsistente con el resto de la app) | 🟡 | ✅ Aplicado |
| 8 | Imágenes (`<img>` crudo) sin `next/image`, sin `images.remotePatterns` | 🟡 | Recomendación (ya documentado en TECH_DEBT.md F4) |
| 9 | `useWebSocket` con backoff exponencial + cleanup correcto | 🟢 | Ya está bien (verificado) |
| 10 | Fuentes vía `next/font/google` (self-hosted, sin bloqueo) y sin `@import` CSS externo | 🟢 | Ya está bien (verificado) |

---

## 1. Bundle por ruta

### 1.1 Tabla real (First Load JS, gzip, medido)

| Ruta | Peso inicial (gzip) | Chunks |
|---|---|---|
| `/`, `/admin`, `/chats`, `/login`, `/register`, `/_not-found` | ~291 KB | 9 |
| `/feed`, `/map`, `/search` | ~294 KB | 10 |
| `/profile`, `/shifts/new` | ~297 KB | 10 |
| `/my-shifts`, `/shifts` | ~298 KB | 11 |

Composición del piso compartido (~291 KB, presente en el 100% de las rutas):

| Chunk (contenido) | Tamaño (gzip) |
|---|---|
| Sentry (`@sentry/nextjs`) | ~138 KB |
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

### 1.3 🔴 Sentry se importa entero en cada ruta (recomendación, no aplicado)

`frontend/instrumentation-client.ts:5` hace `import * as Sentry from
"@sentry/nextjs"` a nivel de módulo, y `instrumentation.ts:2` hace lo mismo
para el lado servidor. `instrumentation-client.ts` es un archivo especial de
Next.js: se carga en **todas** las rutas automáticamente, sin importar si el
componente de esa página usa algo de Sentry. El comentario del archivo dice
*"sin DSN este archivo es un no-op y no agrega peso funcional"* — eso es
cierto en runtime (con `Sentry.init` gateado por `if (dsn)`,
`instrumentation-client.ts:9`), pero **no en bundle size**: el `import`
estático de todo el SDK se resuelve en build time, antes de saber si hay DSN,
así que el paquete completo (~138 KB gzip / ~453 KB sin comprimir, el chunk
más grande después de maplibre) viaja en el bundle inicial de cada página
tenga o no tenga sentido ahí.

- **Impacto:** alto — es, junto con `motion`, la mayor parte del piso
  compartido de 291 KB que paga cada ruta, incluidas `/login` y `/register`
  (páginas de conversión, donde el JS que se ejecuta antes del primer input
  importa más).
- **Por qué no es quick win:** `instrumentation-client.ts` exporta
  `onRouterTransitionStart = Sentry.captureRouterTransitionStart`
  (`instrumentation-client.ts:19`), que Next.js espera **sincrónicamente** al
  cargar el módulo para instrumentar las transiciones de router. Convertir el
  `import` en dinámico (`await import("@sentry/nextjs")`) rompería ese
  contrato o cambiaría cuándo Sentry empieza a capturar errores (ventana de
  arranque sin instrumentación) — es un cambio de comportamiento del
  monitoreo de errores en producción, no verificable con los tests
  disponibles acá (no hay DSN configurado en este entorno), así que queda
  fuera del alcance de "quick win seguro".
- **Recomendación concreta para Julieta:**
  1. Envolver `next.config.ts` con `withSentryConfig` de `@sentry/nextjs`
     (hoy no está — confirmado, `next.config.ts` exporta `nextConfig` sin
     wrap). El plugin oficial habilita tree-shaking de integraciones no
     usadas (replay, profiling) y opciones como `disableLogger: true` que
     suelen recortar el SDK de forma medible.
  2. Cambiar `import * as Sentry` por imports nombrados
     (`import { init, captureRouterTransitionStart } from "@sentry/nextjs"`)
     y medir con `--experimental-analyze` si mejora el tree-shaking.
  3. Cualquiera de las dos requiere medir antes/después con DSN real
     configurado y correr el flujo completo de login/feed/chat para
     confirmar que Sentry sigue capturando errores — por eso se deja como
     tarea aparte, no como parte de esta auditoría.
- **Esfuerzo:** medio. **Riesgo:** medio (observabilidad en producción).

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

### 3.2 🟡 Marcadores de mapa: re-render de todos al seleccionar uno (recomendación, no aplicado)

`components/WorkerSearchMap.tsx:69` y `components/worker/ShiftMap.tsx:126,140`
pasan `onClick={() => toggle(worker.profile_id)}` /
`onClick={() => onSelect(shiftId)}` — una función **nueva en cada render**
del padre — a `WorkerMarker`/`ShiftMarker`/`ClusterMarker`, ninguno de los
cuales usa `React.memo`. Resultado: al tocar un marcador para seleccionarlo
(cambia `selectedId`/`activeId`), el padre re-renderiza y **todos** los
marcadores de la lista se re-renderizan, no sólo el que cambió de estado
`active`.

- **Por qué no se aplicó memo como "quick win":** envolver
  `WorkerMarker`/`ShiftMarker`/`ClusterMarker` en `React.memo` **sin también
  estabilizar el `onClick`** no cambia nada — React.memo compara props por
  referencia, y el `onClick` sigue siendo una función distinta en cada
  render, así que el memo nunca "pega". Para que sea efectivo hay que
  cambiar la firma de `onClick` (hoy `() => void`) a algo como `onClick:
  (id: string) => void` y mover el `useCallback` estable al padre — un
  cambio que toca la API pública de 3 componentes de mapa y sus 2
  consumidores (`WorkerSearchMap.tsx`, `worker/ShiftMap.tsx`), es decir, un
  refactor acotado pero real, no una línea suelta. El enunciado pide no
  refactorizar arquitectura sin necesidad clara, así que se deja documentado.
- **Impacto:** bajo hoy (mapas con decenas de pines demo), pero es
  exactamente el escenario (mapa de ciudad con cientos de comercios/turnos)
  donde este patrón sí se siente — cada marcador hace su propio `useState`
  (`broken`, para el fallback de foto) y tiene una animación CSS de entrada
  (`markerPop`), así que el costo de re-render no es cero.
- **Recomendación:** si se prioriza, cambiar la firma de `onClick` a recibir
  el id/props relevantes y envolver los 3 componentes en `React.memo`, con
  `useCallback` en `WorkerSearchMap`/`ShiftMap` para los handlers. Esfuerzo
  bajo-medio, riesgo bajo (son componentes de presentación puros).

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

### 4.1 🟠 `prefers-reduced-motion`: cubierto para CSS, no para `motion` (recomendación, no aplicado)

`app/globals.css:110-119` tiene una regla global `@media
(prefers-reduced-motion: reduce)` que fuerza `animation-duration`/
`transition-duration` a `0.01ms` — cubre las animaciones **CSS** del mapa
(`markerPop`, `markerHalo`, `urgentPulse`, `puckHalo`). Pero **no cubre
`motion`** (Framer Motion anima con estilos inline vía WAAPI/rAF, no con las
propiedades CSS `animation`/`transition` que la regla `!important`
sobreescribe). La prueba de que esto ya se sabía: `components/worker/MapSheet.tsx:26,60`
es el **único** de los 13 archivos que usan `motion` que llama a
`useReducedMotion()` de `motion/react` y condiciona su `transition` a
`{ duration: 0 }` cuando corresponde. Los otros 12
(`Button.tsx`, `Card.tsx`, `Chip.tsx`, `EmptyState.tsx`, `FAB.tsx`,
`Modal.tsx`, `SegmentedControl.tsx`, `Sheet.tsx`, `Toast.tsx`,
`SplashScreen.tsx`, `SwipeDeck.tsx`, `app/page.tsx`) no lo hacen — un usuario
con "reducir movimiento" activado igual ve el spring del swipe, el pop del
splash con anillos `repeat: Infinity`, etc.

- **Por qué no es quick win:** son 12 archivos con distintos patrones de
  animación (`whileTap`, `initial/animate/exit`, `drag`); aplicar
  `useReducedMotion()` correctamente en cada uno (y no romper el
  `AnimatePresence`/`drag` de `SwipeDeck`, que es la interacción central de
  `/feed`) requiere revisar cada caso, no es un cambio mecánico de una
  línea repetida 12 veces.
- **Recomendación:** priorizar `SwipeDeck.tsx` (interacción principal,
  usuarios con motion sensitivity necesitan una alternativa sin drag/spring)
  y `Button.tsx`/`Card.tsx`/`Chip.tsx` (están en cada pantalla). Esfuerzo
  medio, riesgo bajo (es acotarse a lo que el usuario ya pidió vía SO/browser).

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

## Quick wins aplicados en este PR

1. ✅ `components/ImageUpload.tsx:49-55` — agregado `loading="lazy"
   decoding="async"` al preview de imagen (consistencia con el resto de la
   app, sin cambio de layout).
2. ✅ `components/WorkerSearchMap.tsx:35-42` — el filtro de `workers` con
   coordenadas ahora usa `useMemo([workers])` en vez de recalcularse en cada
   render (incluido cada tap de selección de marcador).

Ambos son cambios de una función pura/atributos HTML sin efecto visible;
verificados con `tsc --noEmit`, `next build` y la suite de Playwright (3/3)
sin regresiones.

## Recomendaciones para decidir (no aplicadas)

| # | Qué | Esfuerzo | Riesgo |
|---|---|---|---|
| 1.3 | Tree-shaking/lazy-load de Sentry (`withSentryConfig`, imports nombrados) | Medio | Medio (observabilidad) |
| 1.4 | `whileTap` de Button/Card/Chip a CSS puro (`active:scale-95`) | Bajo-medio | Bajo (cambia sensación táctil) |
| 2.3 | Migrar `<img>` a `next/image` + `images.remotePatterns` | Medio | Bajo-medio |
| 3.2 | Estabilizar `onClick` de marcadores de mapa + `React.memo` | Bajo-medio | Bajo |
| 4.1 | `useReducedMotion()` en los 12 archivos de `motion` que no lo tienen | Medio | Bajo |
