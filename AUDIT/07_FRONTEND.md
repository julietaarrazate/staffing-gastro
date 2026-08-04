# 07 — Frontend

> Fase 7 de la auditoría OÍDO. Cubre: Next.js, PWA, SEO, accesibilidad,
> responsive, UX, estado, Core Web Vitals, code splitting, Server/Client
> Components. Performance específica (bundle, N+1 de datos, imágenes) ya se
> cubrió en `04_PERFORMANCE.md` y no se repite. Metodología: lectura directa
> de `frontend/app/layout.tsx`, `frontend/app/manifest.ts`, conteos
> actualizados de patrones de accesibilidad, y contraste de
> `docs/STATUS.md` (bitácora viva) contra el resumen que trae `CLAUDE.md` en
> su propio encabezado. Sin cambios de código.

## 1. Server vs Client Components

**78 de 94** archivos `.tsx` en `frontend/app`+`frontend/components`
(83%) declaran `"use client"`. Es una app fuertemente client-rendered, no
un uso típico de RSC "por defecto, cliente sólo donde hace falta estado".
**No es un defecto** dado el perfil del producto: gestos táctiles (swipe),
WebSocket en vivo (chat, notificaciones), mapas interactivos y formularios
con validación — todo eso necesita cliente. Es coherente con
`docs/PRINCIPLES.md` #2 ("sensación nativa, no una web"). Se documenta acá
como dato objetivo, no como hallazgo a corregir: forzar más Server
Components en una app de esta naturaleza agregaría complejidad
(serialización de props, boundaries) sin beneficio real de performance
percibida, dado que casi toda pantalla requiere interactividad inmediata.

## 2. PWA — instalable, y ahora también con Service Worker (dato que corrige `04_PERFORMANCE.md`/`PERFORMANCE_REPORT.md`)

`frontend/app/manifest.ts` define manifest instalable (íconos, `display:
standalone`). **Corrección a un dato de la fase anterior:** `PERFORMANCE_REPORT.md
§3.5` (y el resumen de `04_PERFORMANCE.md`) hereda la afirmación "no hay
`service-worker`/`sw.js` en el repo" — **ya no es así**:
`frontend/public/sw.js` existe (65 líneas), registrado desde
`frontend/lib/push.ts:31` (`navigator.serviceWorker.register("/sw.js")`).
El propio archivo se auto-documenta: *"Service worker mínimo, sólo para Web
Push... El repo NO tenía service worker antes de esto: no se agrega ningún
tipo de caching/offline"*. Es decir: **la premisa cambió (sí hay SW), pero
la conclusión de fondo sigue siendo válida** (no hay caching offline ni
aceleración de visitas repetidas vía Cache API) — el SW existe
exclusivamente para recibir/mostrar notificaciones push, un propósito
distinto y ya cumplido. Se corrige acá para que `13_ROADMAP.md` no
recomiende "agregar un service worker" cuando ya existe uno con otro
propósito — lo que falta específicamente es *cachear el app shell*, no
*crear el service worker desde cero*.

## 3. SEO — mejor cubierto de lo que sugiere el resto de la documentación

`frontend/app/sitemap.ts`, `frontend/app/robots.ts` y metadata completa en
`frontend/app/layout.tsx:36-65` (`metadataBase`, `openGraph`, `twitter`)
existen y están pobladas, apuntando ya al dominio futuro
`https://staffya.com.ar` (documentado a propósito en `docs/DEPLOY.md
§Dominio propio` — "el código ya asume ese dominio... no hace falta tocar
nada ahí, sólo conectar el dominio de verdad"). Es SEO base real, no sólo
la ausencia de errores. No se encontró un doc dedicado a SEO (razonable,
es poca superficie para ameritar uno propio) — no es un hallazgo, se
confirma simplemente que existe y está bien encaminado.

## 4. Accesibilidad — mejoró en volumen absoluto desde la última medición

`docs/AUDIT_REPORT.md` (hace más de un mes) medía `aria-*` en 13 de 56
archivos y `focus-visible`/`focus:ring` en 7 de 56. Reconteo hoy sobre el
árbol actual (94 archivos `.tsx` en `app`+`components`, creció por las
pantallas nuevas de responsive/desktop y las features del último mes):

| Patrón | Entonces (13/56 → 23%) | Hoy (94 archivos) | % hoy |
|---|---|---|---|
| `aria-*` | 13 archivos | **32 archivos** | 34% |
| `focus-visible`/`focus:ring` | 7 archivos | **9 archivos** | 10% |

**`aria-*` mejoró tanto en absoluto como en proporción** (23%→34%) — más
que el crecimiento del árbol de archivos, así que no es sólo dilución. **El
foco de teclado (`focus-visible`) casi no se movió en absoluto (7→9) y bajó
en proporción** (12.5%→10%) — sigue dependiendo casi enteramente de que los
componentes del Design System (`Button.tsx`, que ya trae
`focus-visible:ring-2` de fábrica) se usen en vez de controles ad-hoc.
Sigue sin haber lint rule ni checklist de accesibilidad — no se convirtió
en gate, sigue siendo esfuerzo manual y disperso. Prioridad Media
(consistente con lo ya catalogado en `docs/TECH_DEBT.md` F4).

## 5. Responsive/desktop — la auditoría "en curso" de `CLAUDE.md` está más avanzada de lo que dice su propio encabezado

Hallazgo de coherencia doc↔doc, no doc↔código: `CLAUDE.md` (dice "Última
actualización: 2026-07-29" en su propio encabezado) lista como resueltas
`/map`, `/feed`, `/shifts`, `/search`, y como pendientes "en orden de
valor: `/my-shifts`, `/chats`, resto". **`docs/STATUS.md` (la bitácora
viva que el propio `CLAUDE.md` manda leer primero) ya registra 3 pantallas
más resueltas, con fecha 2026-08-02** — `/my-shifts`, `/chats` (con un
layout de inbox nuevo, `app/chats/layout.tsx`) y `/profile` (layout de 2
columnas tipo dashboard). Lo que queda pendiente hoy, según `STATUS.md`,
es más acotado que lo que sugiere el encabezado de `CLAUDE.md`:
`/shifts/new` (wizard), `/shifts/[id]/candidates`, `/workers/[id]`,
`/companies/[id]`, `/subscription`, `/admin` — 6 pantallas, no "resto"
indefinido.

Este es, de hecho, el escenario que el propio `CLAUDE.md` anticipa en su
segunda línea (*"si pasó mucho tiempo desde esta fecha, desconfiá... y
releé `docs/STATUS.md`"*) — la advertencia resultó necesaria incluso a los
pocos días de escrita, lo cual confirma que el mecanismo (delegar el
estado vivo a `STATUS.md` en vez de mantenerlo en dos lugares) funciona
como diseño, pero también que **el encabezado de `CLAUDE.md` en sí mismo
se desactualiza rápido** y conviene refrescarlo en cada sesión que cierre
una pantalla más, no dejarlo desfasado varios días. Acción concreta en
`13_ROADMAP.md`: actualizar el encabezado de `CLAUDE.md` con las 3
pantallas ya resueltas y la lista corta de 6 pendientes.

**Patrón del problema, ya bien diagnosticado por el propio equipo** (no se
repite el análisis, se cita): contenedores `max-w-md`/`max-w-2xl` fijos o
componentes pensados para gesto táctil (swipe, bottom sheet) que en `md+`
no ganan layout alternativo. La solución consistente en las 7 pantallas ya
resueltas es la correcta arquitectónicamente: layout alternativo real
(grilla, panel lateral, dos columnas) sólo en `md+`/`lg+`, mobile
intacto — no un simple `max-width` más ancho.

## 6. Estado — sin cambios desde `AUDIT_REPORT.md`

Un solo contexto (`lib/auth-context.tsx`), sin Redux/Zustand — sigue siendo
proporcional al tamaño de la app, no se encontró necesidad de un state
manager más pesado en ninguna pantalla nueva revisada en esta auditoría.

## 7. Veredicto de esta fase

El frontend está mejor de lo que documentan otros archivos que lo
describen de pasada: SEO base real, service worker ya existente (aunque
acotado a push), accesibilidad en mejora real y medible. El hallazgo con
más valor de esta fase no es un bug de código sino un desfasaje de
**minutos/días**, no de meses, entre `CLAUDE.md` y `STATUS.md` — la prueba
de que el propio mecanismo de "la bitácora viva manda" funciona, y una
oportunidad de mantenerlo más ajustado. El trabajo pendiente real
(6 pantallas del barrido de responsive, accesibilidad de foco de teclado)
ya está correctamente identificado por el propio equipo — no hay
hallazgos nuevos de fondo, sólo confirmaciones y una corrección de dato
(service worker) que se traslada a `13_ROADMAP.md`.
