# STATUS.md — Bitácora de avance del proyecto

> **Leer esto primero al arrancar una sesión.** Resume dónde estamos, qué está
> en vuelo y qué sigue, para no tener que releer todo el historial.
> **Regla de mantenimiento:** actualizar esta bitácora en el mismo PR cada vez
> que se mergea un cambio relevante (o inmediatamente después).

*Última actualización: 2026-07-02 · rama de trabajo:
`claude/staffya-platform-spec-40hf7l` · todos los PRs se mergean con squash
apenas quedan verdes (pedido de Julieta).*

## Estado en una línea

Producto demo completo y auditado (~65/100 production-readiness); documentación
al día; CI activo; **mapas F1+F2 sobre MapLibre listos** (falta F3); próximo
gran pendiente: migrar la DB a Neon (R0.1, bloqueado en crear la cuenta).

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

## En vuelo ahora

- Nada — próximo bloque: Mapas F3.

## Próximos pasos (orden acordado)

1. **Mapas F3**: migrar `/search` y `MiniMap` a MapLibre, tiempos por modo,
   "cómo llegar" (deep-link), desinstalar Leaflet.
2. **R0.1 — DB a Neon** 🔴: bloqueado en que Julieta cree la cuenta/DB en Neon
   y cargue `DATABASE_URL` en Render. Es el riesgo más grave (la DB free de
   Render **expira a los 90 días**).
3. **R1 (go-live)**: Sentry + logging estructurado, sesiones revocables
   (ADR-0002), CSP, capar `quantity` a 1, runbook para apagar seed demo.
4. **R2**: paginación, fix N+1 (chat inbox, postulantes), matching acotado en
   SQL, métricas de reputación reales.
5. Estrategia de mercado: beta cerrada en Palermo post R0+R1 (ver
   [RECOMMENDATIONS.md](./RECOMMENDATIONS.md)).

## Decisiones clave vigentes

- **Squash merge, PR draft primero, mergear apenas verde** (pedido explícito).
- **Orquestación de modelos**: Fable solo orquesta/sintetiza/revisa; agentes
  Sonnet implementan y auditan; Haiku para lo trivial (pedido explícito para
  no gastar de más).
- **ADR obligatorio** para infra nueva (Redis, sesiones, multi-asignación,
  pagos). ADR-0001 (MapLibre) en curso con F1.
- `quantity>1` es un bug de producto conocido: se capa a 1 en R1 salvo
  decisión de implementar multi-asignación.
- Cuentas demo con contraseña pública: **correcto para la etapa demo**, apagar
  y purgar antes de usuarios reales (checklist en PRODUCTION_READINESS).

## Dónde está cada cosa

- Veredicto y puntajes: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- Plan por fases: [ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md)
- Diseño de mapas: [MAPS_REDESIGN.md](./MAPS_REDESIGN.md) + `docs/mockups/`
- Deuda vigente: [TECH_DEBT.md](./TECH_DEBT.md)
- Cómo trabajar en el repo: [../CLAUDE.md](../CLAUDE.md)
