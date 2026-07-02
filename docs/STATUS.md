# STATUS.md — Bitácora de avance del proyecto

> **Leer esto primero al arrancar una sesión.** Resume dónde estamos, qué está
> en vuelo y qué sigue, para no tener que releer todo el historial.
> **Regla de mantenimiento:** actualizar esta bitácora en el mismo PR cada vez
> que se mergea un cambio relevante (o inmediatamente después).

*Última actualización: 2026-07-02 · rama de trabajo:
`claude/staffya-platform-spec-40hf7l` · todos los PRs se mergean con squash
apenas quedan verdes (pedido de Julieta).*

## Estado en una línea

Producto demo completo y auditado; documentación al día; CI activo; **mapas
100% MapLibre (Leaflet eliminado)**; sesiones revocables y performance R2.1–R2.3
listos; próximo gran pendiente: migrar la DB a Neon (R0.1, bloqueado en crear
la cuenta).

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
| R1.3 + R1.5a (CSP + unit tests del scoring) | #55 | CSP en `next.config.ts` (sólo producción; permite backend propio, WS, tiles CARTO y Cloudinary); 25 unit tests puros de `matching/domain/scoring.py` (pesos, casos límite, orden con trade-offs — un test traía una expectativa incorrecta, corregida: el orden real `equilibrada > lejos_pero_excelente > cerca_pero_nueva` es el comportamiento correcto de los pesos documentados, no un bug). `pytest -q` verde (116 tests) |

## En vuelo ahora

- **R1.5b — E2E Playwright** y **R2.4/R2.5** (agentes despachados; el intento
  anterior de ambos chocó con el límite de sesión del proveedor sin avanzar,
  se relanzan). Bloqueados en Julieta: **R0.1 Neon** y **R1.1 Sentry** (tiene
  las cuentas, faltan los env vars en Render/Vercel — instrucciones dadas).

## Próximos pasos (orden acordado)

1. **R1 restante que no depende de terceros**: CSP en el frontend (R1.3) y
   unit tests del scoring + E2E Playwright en CI (R1.5).
2. **R0.1 — DB a Neon** 🔴: bloqueado en que Julieta cree la cuenta/DB en Neon
   y cargue `DATABASE_URL` en Render. Es el riesgo más grave (la DB free de
   Render **expira a los 90 días**).
3. **R1 (go-live)**: Sentry + logging estructurado, runbook para apagar
   seed demo. (Sesiones revocables y capar `quantity` — R1.2/R1.4 — ya
   implementados, ver bloque arriba.)
4. **R2 restante**: métricas de reputación reales (R2.4), imágenes propias en
   el seed (R2.5). (Paginación, fix N+1 y matching en SQL — R2.1–R2.3 — ya
   implementados, ver bloque arriba.)
5. Estrategia de mercado: beta cerrada en Palermo post R0+R1 (ver
   [RECOMMENDATIONS.md](./RECOMMENDATIONS.md)).

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
