# STATUS.md — Bitácora de avance del proyecto

> **Leer esto primero al arrancar una sesión.** Resume dónde estamos, qué está
> en vuelo y qué sigue, para no tener que releer todo el historial.
> **Regla de mantenimiento:** actualizar esta bitácora en el mismo PR cada vez
> que se mergea un cambio relevante (o inmediatamente después).

*Última actualización: 2026-07-10 · rama de trabajo:
`claude/staffya-platform-spec-40hf7l` · todos los PRs se mergean con squash
apenas quedan verdes (pedido de Julieta) · **loop autónomo activo** (con
auto-merge, confirmado explícitamente por Julieta) para retomar el backlog no
bloqueado sin esperar "seguí" en cada paso.*

## Estado en una línea

**Todo el backlog implementable sin credenciales/decisiones de Julieta está
cerrado** (R0.3, R1.1–R1.6, R2.1–R2.4, R3.1, R3.2 ✅). Lo único que falta:
🔶 confirmar en Render que el deploy quedó verde contra Neon (código ya en
`main`), cargar los DSN de Sentry cuando quiera, y decisiones de producto con
ADR (multi-asignación, cancelaciones, imágenes propias). **R4 se deja afuera a
propósito** hasta que haya señal real de carga (regla del propio roadmap).

## Hecho y mergeado (cronológico, con PR)

| Bloque | PRs | Qué quedó |
|--------|-----|-----------|
| Rediseño UX/UI mobile-first ("app nativa") | #33–#40 | DS propio (`components/ui/`), worker swipe/mapa/matches, employer panel+wizard+postulantes, splash/landing, performance |
| Seed demo en producción | #36 | `startup_seed` idempotente (`SEED_DEMO_DATA=true` en Render): cuentas/turnos demo para probar sin registrarse |
| Design System v2 (dirección creativa) | #41–#43 | Identidad monocromática (#FF6B00/#111/blanco), Lucide, foto-first + acento sobrio por rubro (`SKILL_ACCENT`), navbar opaca (fix scroll), tiles CARTO |
| Documentación Fase 0–1 | #43 | Auditoría v1 + fundación (`PRODUCT/DOMAIN/ARCHITECTURE/PRINCIPLES`) + `CLAUDE.md` operativo |
| Documentación Fase 2 (dominio) | #44 | 10 docs de dominio (`WORKER…AVAILABILITY`), inconsistencias marcadas |
| Documentación Fase 3 (técnica) | #45 | 8 docs (`MODULES/API/DATABASE/EVENTS/SECURITY/TESTING/DEPLOY/OBSERVABILITY`) |
| Seguridad quick wins | #46 | JWT default bloqueado en prod, security headers, rate limit login/register (429) |
| Refactor quick wins | #47 | `PageState` y `SKILL_STYLES` eliminados (DS único), botones inline→`Button`, helpers de test compartidos, seed limpio |
| Diseño de mapas | #48 | `docs/MAPS_REDESIGN.md` (10 entregables) + mockup HTML. **Diseño aprobado por Julieta** |
| Auditoría integral v2 | #49 | 9 reportes con puntajes (`PRODUCTION_READINESS` ~65/100) + `ROADMAP_IMPLEMENTATION.md` (R0–R4) + `RECOMMENDATIONS` v2 |
| CI | #50 | GitHub Actions: `pytest` + `tsc` + `build` en cada PR/push a main (R0.3 ✅) |

| Mapas F1+F2 (MapLibre) | #51 | Módulo `components/map/` (`maplibre-gl` + `@vis.gl/react-maplibre` + `supercluster`), ADR-0001, `/map` premium: sheet 40/60 de 3 alturas, marcadores por rubro con stagger/halo, clustering, sync mapa↔tarjetas. Verificado con Playwright (smoke con mocks). Leaflet convive hasta F3 |
| Mapas F3 (adiós Leaflet) | #52 | `WorkerSearchMap` (marcador avatar+rating, tarjeta DS en vez de popup) y `MiniMap` sobre MapLibre; tiempos por modo "aprox." (`lib/map/travel-time.ts`) en el carrusel; botón "Cómo llegar" (deep-link Google Maps) en `ShiftCard`; **leaflet/react-leaflet desinstalados**, `map-tiles.ts` eliminado, cero referencias |
| R1.2 + R1.4 (sesiones revocables + capar `quantity`) | #53 | Tabla `refresh_sessions` (migración `0010`) con rotación de refresh token y detección de reuso (revoca todas las sesiones), `POST /auth/logout`, `ADR-0002`; `quantity` capado a 1 en `ShiftInput` (API) y en el wizard (`shifts/new/page.tsx`). `pytest -q` verde (87 tests), `tsc --noEmit` limpio |
| R2.1–R2.3 (rendimiento backend: paginación + fix N+1 + matching en SQL) | #54 | Inbox de chat (P1) reescrito a 3 queries agregadas (JOIN + batch de último mensaje + batch de no leídos) en vez de ~6 por conversación; postulantes de un turno (P2) enriquecidos con un JOIN en el repo en vez de 2N+1; matching (P4 del reporte) filtra `is_available`+`skill` en SQL (antes full scan + filtro en Python) y sólo scorea en Python el subconjunto ya acotado; `limit`/`offset` agregados a `/shifts/feed`, `/shifts/mine`, `/shifts/me`, `/applications/mine`, `/notifications`, `/admin/users` y `/matching/search` (default 50, tope 100, sin cambiar el shape de la respuesta). Sin cambios de comportamiento visible. `pytest -q` verde (91 tests, +4 de paginación/inbox) |
| Hotfix Neon (R0.1) | #56 | `Settings._force_asyncpg_driver` traduce los parámetros libpq del connection string de Neon (`sslmode`/`channel_binding`, que asyncpg no acepta y rompían el deploy) a `ssl=require`; 4 unit tests. Desbloquea la migración de DB a Neon |
| R2.4 (reputación real) | #57 | `events_completed` y `punctuality_rate` se derivan del ciclo real del turno al finalizarlo (check-in dentro de ±15 min del inicio pactado = puntual; promedio móvil atómico en el repo de worker). `cancellations` NO se deriva: el dominio no distingue quién cancela ni tiene no-show — documentado como decisión de producto pendiente (ADR) en REPUTATION/TECH_DEBT. R2.5 (imágenes Cloudinary en seed) queda manual: requiere subir un set de fotos a la cuenta del proyecto (TECH_DEBT I2) |
| R1.5b (E2E Playwright en CI) | #58 | 3 specs (`auth`, `worker-apply`, `employer-wizard`) con API 100% mockeada (sin backend ni red externa), viewport móvil 390×844; job `e2e` nuevo en el workflow (build + `playwright test`, artifact del reporte si falla). Corrida local: 3 passed |
| R1.1 + R1.6 + R0.2 (observabilidad + runbooks) | #59 | Sentry opcional en backend (`SENTRY_DSN`) y frontend (`NEXT_PUBLIC_SENTRY_DSN`) — no-op sin DSN, se enciende al cargar las env vars; logging estructurado JSON (`LOG_JSON=true`) con `request_id` por request (header `X-Request-ID`); CSP permite el ingest de Sentry. DEPLOY.md: runbook de lanzamiento (apagar seed demo + purga) y backups/restore de Neon |
| R1.3 + R1.5a (CSP + unit tests del scoring) | #55 | CSP en `next.config.ts` (sólo producción; permite backend propio, WS, tiles CARTO y Cloudinary); 25 unit tests puros de `matching/domain/scoring.py` (pesos, casos límite, orden con trade-offs — un test traía una expectativa incorrecta, corregida: el orden real `equilibrada > lejos_pero_excelente > cerca_pero_nueva` es el comportamiento correcto de los pesos documentados, no un bug). `pytest -q` verde (116 tests) |
| R3.2 (DS v2 en Employer/Admin) | #60, #61 | `/admin` migrado a `Card`/`Badge`/`Button`/`Avatar`/`EmptyState`/`ErrorBanner`/`Spinner` (verificado por mí, no solo por el reporte del agente); color fuera de paleta (`bg-blue-600`) corregido en el botón "Publicar" de `/shifts`. Sin deuda visual restante en pantallas employer/admin |
| Coherencia doc↔código del roadmap | *(commit directo)* | R0.2, R0.3, R1.1, R1.6 y R3.2 estaban implementados (mergeados en #50/#56/#59/#60/#61) pero sin tildar en `ROADMAP_IMPLEMENTATION.md`; corregido. R0.1 actualizado a 🔶 (código listo, falta confirmación de Julieta en Render) |
| Decisiones de producto con ADR | #63 | Las 3 decisiones que Fable tomó como orquestador: **ADR-0003** (`quantity`=1 permanente, no se construye multi-asignación); **ADR-0004** (cancelación del trabajador `CONFIRMADO`→`BUSCANDO_PERSONAL` que reabre el turno y deriva `cancellations`, `POST /shifts/{id}/worker-cancel`, notificación `shift_reopened`; e insignias/niveles con otorgamiento automático por umbral en `worker/domain/rules.py`, recalculados al finalizar y al cancelar). `pytest -q` verde (150 tests, +28). Cierra P1/P2/P3 de TECH_DEBT |
| Re-baseline de lanzamiento (Fable) | #64 | `docs/LAUNCH_PLAN.md`: re-evaluación de production-readiness (~65→**~78/100** tras mergear R0–R3) + plan secuenciado de beta cerrada en Palermo (B0 pre-lanzamiento → B1 reclutamiento → B2 operación asistida → B3 decisión). Veredicto: **lista para beta con usuarios reales**, sólo faltan 2 pasos operativos de Julieta |
| Reputación visible en el frontend | #65 | `lib/reputation.tsx` como única fuente de labels (insignias, niveles, puntualidad, rating); insignias/nivel en perfil worker, búsqueda del employer y postulantes. Cierra el lado visible de ADR-0004 |
| UX: landing + selección de texto | #66 | La landing es sólo para visitantes sin sesión (logueados van a la home de su rol: `/feed`, `/shifts`, `/admin`); copy ofensivo ("delivery de personas") reemplazado; `user-select:none` en botones/tabs/labels (inputs siguen seleccionables). Fix del E2E `auth.spec.ts` por el redirect nuevo |
| Auditoría de performance frontend | #67 | `docs/PERFORMANCE_AUDIT_FRONTEND.md` con hallazgos archivo:línea (Sentry estático 138 KB gzip 🔴, motion 🟠, marcadores de mapa 🟡, reduced-motion 🟠) + quick wins seguros |
| Performance frontend (fixes) | #68 | Sentry con `import()` dinámico gateado por DSN (sin DSN el SDK no viaja en ninguna ruta — verificado por grep de chunks en `.next/server/app/` y manifests); `memo` + handlers estables en marcadores de mapa (Cluster/Shift/Worker); `useReducedMotion` en landing, splash, swipe, modales, sheets, toasts y mapa |

## En vuelo ahora

- **Ciclo de robustez percibida** (pedido de Julieta): auditoría de las 16
  rutas del frontend buscando cargas sin skeleton, errores de red sin mensaje
  ni reintento y formularios que fallan en silencio; fixes por lotes con
  agentes Sonnet, un PR por lote.
- En cola (features de enganche aprobadas por delegación): #1 ping en tiempo
  real de turnos urgentes (ADR-0005), #3 progreso de gamificación, #4 panel de
  ganancias, #5 onboarding. #2 WhatsApp bloqueado en cuenta API.

## Bloqueado en Julieta (único trabajo pendiente)

1. 🔶 **Confirmar Render/Neon**: el hotfix (#56) y el `DATABASE_URL` ya están
   cargados; falta chequear en el dashboard de Render que el deploy quedó
   verde y `alembic upgrade head` corrió contra Neon. Sin acceso a Render
   desde acá para verificarlo.
2. **Encender Sentry**: cargar `SENTRY_DSN` (Render) y `NEXT_PUBLIC_SENTRY_DSN`
   (Vercel) cuando quiera — el código ya está y es no-op sin esos valores.
3. **R2.5** — imágenes propias en el seed: subir un set de fotos a la cuenta
   Cloudinary del proyecto (TECH_DEBT I2), manual, sin credenciales no se
   puede automatizar.
4. **Elegir logo**: hay 4 concepts presentados (recomendado: #2 Pin+Rayo); al
   elegir se cablea en `Logo.tsx` + favicon + íconos PWA.
5. **Tarjetas "grises" de empleados**: falta que Julieta indique la pantalla
   exacta (o screenshot) — las cards son `bg-white`, la hipótesis es acentos
   pastel + falta de fotos reales (se destraba junto con R2.5).
6. **WhatsApp Business API** (feature de enganche #2): requiere cuenta/API
   del lado de Julieta.

> Las decisiones de producto que estaban pendientes (multi-asignación,
> cancelación por actor, insignias/niveles) ya se **resolvieron** en #63
> (ADR-0003/0004) — ver bloque "Hecho y mergeado". No queda decisión de
> producto abierta salvo que el negocio pida algo nuevo (con su propio ADR).
7. **R4** — deliberadamente en espera hasta que haya señal real de tráfico
   (Redis, bbox multi-ciudad, rutas OSRM, pagos MercadoPago).
8. Estrategia de mercado: beta cerrada en Palermo post R0+R1 (ver
   [RECOMMENDATIONS.md](./RECOMMENDATIONS.md)) — decisión de negocio, no de
   código.

## Decisiones clave vigentes

- **Squash merge, PR draft primero, mergear apenas verde** (pedido explícito).
- **Orquestación de modelos**: Fable solo orquesta/sintetiza/revisa; agentes
  Sonnet implementan y auditan; Haiku para lo trivial (pedido explícito para
  no gastar de más).
- **ADR obligatorio** para infra nueva (Redis, sesiones, multi-asignación,
  pagos). ADR-0001 (MapLibre), ADR-0002 (sesiones revocables).
- `quantity>1` era un bug de producto conocido: **ya se capó a 1** (API +
  wizard, R1.4). Multi-asignación real queda pendiente, sólo si el negocio la
  pide (nuevo ADR).
- Cuentas demo con contraseña pública: **correcto para la etapa demo**, apagar
  y purgar antes de usuarios reales (checklist en PRODUCTION_READINESS).

## Dónde está cada cosa

- Veredicto y puntajes: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- Plan por fases: [ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md)
- Diseño de mapas: [MAPS_REDESIGN.md](./MAPS_REDESIGN.md) + `docs/mockups/`
- Deuda vigente: [TECH_DEBT.md](./TECH_DEBT.md)
- Cómo trabajar en el repo: [../CLAUDE.md](../CLAUDE.md)
