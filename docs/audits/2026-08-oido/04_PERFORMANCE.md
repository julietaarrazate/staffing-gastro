# 04 — Performance

> Fase 4 de la auditoría OÍDO. Cubre: queries N+1, índices, bundle JS,
> hydration, lazy loading, caching, compresión, headers, imágenes, web
> vitals, tiempo de respuesta. A diferencia de las fases 1-3, esta área
> **ya tiene dos auditorías propias, activas y con fecha reciente**:
> [`docs/audits/PERFORMANCE_REPORT.md`](../PERFORMANCE_REPORT.md) (backend +
> DB + frontend, con 3 rondas de actualización, la última del
> `claude/performance` batch) y
> [`docs/audits/PERFORMANCE_AUDIT_FRONTEND.md`](../PERFORMANCE_AUDIT_FRONTEND.md)
> (frontend, medido con `next build` real, mayoría de hallazgos ya
> aplicados). Esta fase **no las repite**: verifica con spot-checks contra
> el código de hoy (2026-08-04, commit `812c114`) qué sigue realmente
> abierto, y señala qué quedó desactualizado. Sin cambios de código.

## 1. Qué ya está resuelto (verificado, no repetido en detalle)

De los hallazgos originales de `PERFORMANCE_REPORT.md`, confirmados
**cerrados con evidencia de código real** (no sólo "marcados ✅" en el
propio doc — se sampleó el código correspondiente):

- **P1** (N+1 de inbox de chat) y **P2** (N+1 de postulantes) — resueltos
  con batch queries (`list_by_ids`/`JOIN`), con tests dedicados que cuentan
  queries reales.
- **P3** (N de comercios en feed) — resuelto con `list_by_ids`.
- **P4** (matching sin acotar por SQL) — resuelto parcialmente: filtro de
  `is_available`/`skill` ya en SQL; el scoring ponderado (Haversine,
  experiencia) sigue en Python **a propósito** sobre el subconjunto ya
  acotado — es lógica de dominio, no de acceso a datos, decisión correcta.
- **Paginación transversal** (R2.1) — `limit`/`offset` (default 50, tope
  100) en la mayoría de los listados.
- **Pool de conexiones** (`core/database.py`) y **seed bloqueante en cada
  arranque** — ambos resueltos en el batch de performance más reciente, con
  mediciones antes/después documentadas en el propio reporte (incluye un
  bug de paso encontrado y corregido: el seed estaba silenciosamente roto
  por un `TypeError` en `IdentityService(...)`, capturado por un
  `except Exception` genérico).
- **Frontend — Sentry importado entero en cada ruta** (~138 KB gzip en el
  100% de las páginas) — resuelto con import dinámico gateado por DSN.
- **Frontend — re-renders de marcadores de mapa** y **filtro recalculado en
  cada render de `WorkerSearchMap`** — ambos resueltos.
- **Mapas ya code-splitteados** (`next/dynamic` con `ssr:false`),
  verificado hoy de nuevo: `frontend/app/search/page.tsx:29`
  (`WorkerSearchMap`) y `frontend/app/map/page.tsx:20` (`ShiftMap`) —
  `maplibre-gl` (266 KB gzip) no aparece en ninguna ruta que no sea mapa
  (medido en `PERFORMANCE_AUDIT_FRONTEND.md §1.2`).

## 2. Qué sigue abierto — verificado hoy, sin regresión ni mejora

- **P5 — `/admin/stats` sigue trayendo toda la tabla `users` y contando en
  Python.** Confirmado de nuevo: `admin/application/services.py:44`
  (`get_stats`) sigue llamando `self._users.list_all()` sin `GROUP BY`/
  `func.count()`. Prioridad Media, esfuerzo bajo — sigue siendo el quick
  win más barato pendiente de esta área.
- **Commit por repositorio, no por caso de uso** — sin cambios; sigue
  siendo un problema de diseño transversal (~9 módulos), no una regresión
  puntual. Esfuerzo medio-alto por su naturaleza transversal, correctamente
  priorizado como "Media" y no "Alta" dado que la probabilidad de fallo
  entre dos commits consecutivos es baja en la práctica.
- **`<img>` sin `next/image` — empeoró en cantidad, no en criticidad.**
  `PERFORMANCE_REPORT.md` contaba 7 usos; hoy son **11**
  (`companies/[id]`, `chats/layout.tsx`, `search`, `workers/[id]`,
  `Avatar.tsx`, `OpportunityCard.tsx`, `ImageUpload.tsx`, `Logo.tsx`,
  `ImageCropModal.tsx`, `WorkerMarker.tsx`, `MiniMap.tsx`). Es crecimiento
  natural (más pantallas), no regresión activa — pero confirma que el
  patrón "usar `<img>` crudo" se sigue replicando en código nuevo en vez de
  adoptar `next/image` una vez y que el resto herede. Sólo **2 de 11**
  (`Logo.tsx`, `ImageCropModal.tsx`) usan `next/image` — probablemente
  casos donde el asset es local/estático, no la foto de usuario vía
  Cloudinary que es el caso de mayor volumen. Prioridad Media (sin
  cambios).
- **Sin SWR/React Query** — confirmado, `grep` de `swr`/`react-query` en
  `package.json` sin resultados. Sin cambios.
- **Listas sin virtualización, PWA sin service worker, sin capa de
  caché** — sin cambios reportables, no se re-verificó línea por línea por
  no aportar nada nuevo a lo ya documentado.
- **`motion` en el bundle de todas las rutas** (~40 KB gzip por el
  `whileTap` del botón del Design System) — `PERFORMANCE_AUDIT_FRONTEND.md`
  ya lo marca como "recomendación, sin tocar por decisión" (no vale la pena
  romper la micro-interacción del DS para ahorrar 40 KB). Decisión de
  producto explícita, no deuda olvidada.

## 3. Documentación desactualizada encontrada en esta fase

- `docs/reference/DATABASE.md` sigue sin corregir la afirmación "sin índices
  documentados para las búsquedas frecuentes" — `PERFORMANCE_REPORT.md
  §2.1` ya identificó esto como falso (los índices sí existen en `shifts`)
  hace tiempo, y **la corrección propuesta ahí mismo todavía no se aplicó**
  a `DATABASE.md`. Se retoma en `05_DATABASE.md` de esta auditoría.
- `docs/audits/SCALABILITY_REPORT.md` (no repetido en detalle en esta fase, es
  más territorio de `06_INFRASTRUCTURE.md`) todavía dice en su resumen
  ejecutivo *"un reloj corriendo real (expiración de la DB a los 90
  días)"* — eso describe el Postgres gestionado de Render, **reemplazado
  por Neon el 2026-07-23** según `CLAUDE.md`. Es la misma familia de
  desfasaje que ya se señaló en `02_ARCHITECTURE.md §1` para
  `docs/foundation/ARCHITECTURE.md`: la infraestructura cambió más rápido que los
  documentos de auditoría que la describen. Se profundiza en
  `06_INFRASTRUCTURE.md`.

## 4. Veredicto de esta fase

El trabajo de performance de este repo es, hasta ahora, el área **mejor
instrumentada de toda la auditoría**: tiene mediciones reales (conteo de
queries con `before_cursor_execute`, tamaños de bundle con `next build`
real, benchmarks de pool de conexiones antes/después), no sólo lectura de
código. La mayoría de los hallazgos "Alta prioridad" de la ronda original
ya están cerrados con test de regresión dedicado. Lo que queda abierto es
consistentemente de prioridad Media/Baja y esfuerzo bajo/medio — no hay
ningún hallazgo de performance crítico sin resolver hoy. El puntaje 58/100
de `PERFORMANCE_REPORT.md` **no está vigente** (quedó fijado antes del
batch de performance más reciente, que resolvió 3 de los hallazgos de
mayor impacto real: pool de conexiones, seed bloqueante, y la mayoría de
paginación/N+1) — no se recalcula un número nuevo en esta fase para no
inventar una metodología de scoring distinta a la que ya usó ese
documento; se dan por buenos sus hallazgos, corregido su estado.
