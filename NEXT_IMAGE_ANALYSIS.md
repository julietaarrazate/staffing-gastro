# NEXT_IMAGE_ANALYSIS.md — `<img>` vs `next/image` (análisis, sin cambios de código)

> Encargado como parte de PRODUCTION_HARDENING.md (Fase 2 — Performance). Alcance
> explícito: **sólo análisis**, ningún componente fue modificado en este documento.
> Plan de migración priorizado al final, para ejecutar después con validación
> visual (Playwright o revisión manual).

## Contexto: por qué el beneficio es menor de lo habitual acá

Casi todas las fotos remotas (perfiles de trabajador, logos de comercio) pasan por
`cldThumb()` (`frontend/lib/cloudinary.ts`), que ya le agrega a la URL de
Cloudinary `f_auto,q_auto,c_limit,dpr_auto,w_<ancho>`: formato automático
(WebP/AVIF según el browser), calidad automática, resize server-side y DPR
automático. Es decir: **el trabajo que hace `next/image` (reencode, resize,
formato moderno) ya lo está haciendo Cloudinary en el momento de armar la URL.**
El beneficio real de migrar se reduce a lo que Cloudinary no cubre:
`srcset`/`sizes` responsive automático, la integración con el `<link
rel="preload">` de LCP, y placeholders de blur — no a "la imagen pesa menos".

Además, **`next/image` con orígenes remotos no está configurado** (no hay
`images.remotePatterns` en `next.config.ts`): migrar cualquier `<img>` con URL
de Cloudinary requiere agregar esa config primero (cambio de infraestructura,
bajo riesgo, pero es un prerrequisito, no parte de "sólo cambiar el
componente").

## Inventario

Se encontraron **10 usos reales** de `<img>` (la cifra de "11" de la consigna
parece anterior a la migración de `MiniMap.tsx` de un `<img>` de tiles raster
a `MapView`/MapLibre vectorial, ya resuelta — ver comentario en
`components/MiniMap.tsx:9`; hoy ese archivo no tiene ningún `<img>`).

| # | Archivo | Propósito | Origen | Tamaño aprox. | Dimensiones |
|---|---|---|---|---|---|
| 1 | `components/Logo.tsx:42` (`LogoMark`) | Isotipo de marca (header, splash) | Local (`/logo-mark.svg`) | 7.2 KB (SVG) | Fija (`size` prop, ≤48px) |
| 2 | `components/ui/Avatar.tsx:42` | Avatar reusable (7 pantallas: feed, candidatos, admin, chat cards, etc.) | Remoto, Cloudinary vía `cldThumb` | ~5-25 KB (ya optimizado) | Fija (32/44/64/96px según `size`) |
| 3 | `components/ImageUpload.tsx:58` | Preview del avatar propio en el formulario de perfil | Remoto, Cloudinary — **sin `cldThumb`** (URL cruda) | Variable, potencialmente sin resize server-side | Fija (96×96px, contenedor `h-24 w-24`) |
| 4 | `components/ImageCropModal.tsx:132` | Preview interactivo de encuadre (pan/zoom con `<canvas>`) antes de subir | Local, `blob:` (Object URL de un `File` en memoria) | Variable (archivo elegido por el usuario, hasta varios MB sin comprimir) | Dinámica (depende de `naturalWidth/Height` + zoom/offset por `transform` inline) |
| 5 | `components/map/WorkerMarker.tsx:80` | Foto del trabajador en el pin del mapa (`/search`, `/map`) | Remoto — **sin `cldThumb`** (URL cruda) | Variable | Fija (38×38px) |
| 6 | `components/worker/OpportunityCard.tsx:68` | Foto hero del local en la tarjeta de oportunidad (feed, mazo swipe) | Remoto, Cloudinary vía `cldThumb(…, 800)` | ~15-60 KB | Responsiva (`absolute inset-0`, contenedor al `42%` de alto del padre, `min-h-[168px]`) |
| 7 | `app/chats/layout.tsx:120` | Avatar de la otra parte en la lista de conversaciones (lista potencialmente larga) | Remoto — **sin `cldThumb`** (URL cruda) | Variable | Fija (48×48px) |
| 8 | `app/search/page.tsx:151` | Avatar en la lista de resultados de búsqueda del comercio | Remoto — **sin `cldThumb`** (URL cruda) | Variable | Fija (64×64px) |
| 9 | `app/workers/[id]/page.tsx:84` | Foto hero del perfil del trabajador | Remoto, Cloudinary vía `cldThumb(…, 800)` | ~15-60 KB | Fija en alto (`h-56`), 100% de ancho |
| 10 | `app/companies/[id]/page.tsx:88` | Foto hero del perfil del comercio | Remoto, Cloudinary vía `cldThumb(…, 800)` | ~15-60 KB | Fija en alto (`h-56`), 100% de ancho |

**Hallazgo colateral** (no es parte de esta tarea, sólo se documenta): los usos
#3, #5, #7 y #8 no pasan por `cldThumb()` — sirven la imagen en su tamaño
original de Cloudinary en vez de un thumbnail. Es una inconsistencia real y un
desperdicio de ancho de banda independiente de si se migra a `next/image` o
no; queda anotado en `docs/TECH_DEBT.md` como posible quick-win aparte (no se
toca en este PR, fuera de alcance de "sólo análisis").

## Clasificación

### 1. Migración segura (riesgo bajo)

Fotos con **contenedor de tamaño fijo en píxeles**, ya servidas vía Cloudinary
(o triviales de envolver), sin lógica de interacción sobre el `<img>` más allá
de `onError`/`onLoad` estándar (que `next/image` también soporta).

- **`components/ui/Avatar.tsx`** — tamaño fijo por variante (32/44/96px),
  `cldThumb` ya calcula el ancho exacto a pedir. Único cuidado: es un
  componente compartido en 7 pantallas, así que un problema de layout se
  replica en todas — por eso "seguro" pero igual amerita smoke visual antes de
  dar por cerrado.
- **`app/search/page.tsx`** — avatar 64×64 fijo, un solo call site.
- **`app/chats/layout.tsx`** — avatar 48×48 fijo, un solo call site (lista con
  cardinalidad variable, pero cada `<img>` individual es de tamaño fijo).
- **`app/workers/[id]/page.tsx`** y **`app/companies/[id]/page.tsx`** — mismo
  patrón exacto (hero `h-56 w-full`, `cldThumb(…, 800)`); estos dos van bien
  con `fill` + `sizes="100vw"` dado que el contenedor padre ya es
  `position: relative` con alto fijo.

**Beneficio esperado:** marginal en peso (Cloudinary ya optimiza), algo mejor
en CLS (dimensiones reservadas explícitamente) y en priorización de descarga
para las heroes de perfil (candidatas a `priority` por estar above-the-fold).

### 2. Requiere validación visual (riesgo medio)

- **`components/worker/OpportunityCard.tsx`** — el contenedor mide `42%` del
  alto del padre (no un valor fijo), en un componente usado tanto en la
  grilla de escritorio como en el mazo de swipe mobile (gestos táctiles,
  animaciones de entrada/salida). `fill` técnicamente funciona (el padre ya
  es `relative` con alto resuelto en runtime), pero el `sizes` correcto
  depende del breakpoint y hay que verificar que no aparezca layout shift ni
  se rompa la animación del mazo. Es la tarjeta más visible del producto
  (feed del trabajador) — cualquier regresión ahí se nota mucho.
- **`components/map/WorkerMarker.tsx`** — vive dentro de un `<Marker>` de
  `@vis.gl/react-maplibre`, que MapLibre reposiciona con transforms propios
  fuera del flujo normal de layout; puede haber decenas montados a la vez y
  se re-renderizan con el pan/zoom del mapa. No hay razón teórica para que
  falle, pero es la clase de integración (librería de mapas + intersection
  observer de `next/image`) que conviene probar en vivo antes de confiar.

**Beneficio esperado:** mismo argumento que el grupo 1 (CLS, priorización),
algo mayor acá porque son las imágenes más repetidas en pantalla (mazo de
tarjetas, N marcadores en el mapa) — el lazy-loading real de `next/image`
(IntersectionObserver) es más preciso que el atributo `loading="lazy"` nativo
que ya usan.

### 3. Conviene mantener como `<img>`

- **`components/Logo.tsx` (`LogoMark`)** — SVG local ≤48px. `next/image` no
  reencodea SVGs (los sirve tal cual, opcionalmente detrás de
  `dangerouslyAllowSVG`); no hay ninguna optimización que ganar. Ya está
  documentado así en el propio código (`// ícono chico (≤48px), no amerita
  next/image`) — este análisis coincide con esa decisión previa.
- **`components/ImageCropModal.tsx`** — preview de un `blob:` Object URL de un
  `File` todavía no subido, con pan/zoom manual vía `style.transform` inline y
  lectura de `naturalWidth/naturalHeight` en `onLoad` para calcular la
  geometría del recorte. `next/image` no soporta `blob:` como `src` (espera
  una ruta local, una URL remota configurada, o un loader) y su manejo interno
  de `width`/`height`/`sizes` chocaría con las transformaciones manuales que
  ya hace este componente. Migrarlo no ahorra nada (nunca llega a red: es una
  imagen en memoria del propio dispositivo) y sí complica el código.
- **`components/ImageUpload.tsx`** — mismo motivo que el Avatar en teoría
  (tamaño fijo 96px, Cloudinary), pero es el preview *inmediatamente después*
  de subir una foto nueva (`onChange(url)` recién llegado del upload) dentro
  de un botón con overlay/badge superpuestos vía `absolute`; el beneficio es
  mínimo (una sola imagen, no una lista) y el riesgo de romper el layout del
  botón (que ya tiene 3 capas superpuestas: overlay de cámara, badge, spinner)
  no se justifica frente a la ganancia. Si más adelante se decide migrarlo,
  que vaya junto con el fix del hallazgo colateral (agregar `cldThumb`), no
  antes.

## Plan de migración priorizado (para ejecutar después, con validación)

1. **`app/workers/[id]/page.tsx` + `app/companies/[id]/page.tsx`** — mismo
   patrón, se migran juntos. Menor riesgo, mayor beneficio relativo (heroes
   above-the-fold, candidatas a `priority`). Validación: captura antes/después
   en mobile y desktop de ambas pantallas.
2. **`components/ui/Avatar.tsx`** — un solo componente, pero alto radio de
   reuso (7 pantallas). Validación: smoke visual en cada pantalla que lo usa
   (`feed`, `shifts` panel del comercio, candidatos, admin, `WorkerGameCard`),
   prestando atención al fallback por `onError` (inicial sobre gradiente).
3. **`app/search/page.tsx`** y **`app/chats/layout.tsx`** — bajo riesgo, un
   call site cada uno. Pueden ir en el mismo batch que Avatar o inmediatamente
   después.
4. **`components/worker/OpportunityCard.tsx`** — requiere el prerrequisito de
   `fill` + `sizes` bien calibrado y prueba manual del mazo de swipe (mobile)
   y la grilla (desktop) antes de mergear. Hacerlo solo, no junto con otros
   cambios, para poder revertir sin arrastrar nada más si algo se ve mal.
5. **`components/map/WorkerMarker.tsx`** — último, y sólo si los anteriores no
   mostraron sorpresas: es la integración más atípica (mapa vectorial +
   markers). Probar con el mapa cargado con muchos trabajadores simultáneos
   (`/search` en una zona con volumen) antes de dar por cerrado.
6. **No migrar**: `Logo.tsx` (`LogoMark`), `ImageCropModal.tsx`,
   `ImageUpload.tsx` — motivos en la sección de clasificación arriba.

**Prerrequisito común a los pasos 1-5:** agregar `images.remotePatterns` en
`frontend/next.config.ts` para el host de Cloudinary (`res.cloudinary.com`)
antes de tocar el primer componente — sin eso, `next/image` rechaza cualquier
URL remota en build/runtime.
