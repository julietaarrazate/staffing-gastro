# ROADMAP_IMPLEMENTATION.md — De hoy a producción (fases priorizadas)

> Plan de acción derivado de la auditoría integral
> ([PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)). Cada fase es
> mergeable por separado, respeta la arquitectura existente y los principios
> del repo (ADR para infra nueva). Prioridad: primero lo que **pierde datos o
> rompe producción**, después lo que bloquea usuarios reales, después escala.

## R0 — Apagar los riesgos de calendario (1–2 días) 🔴

*Sin esto, todo lo demás puede evaporarse.*

| # | Tarea | Esfuerzo | Dependencias |
|---|-------|----------|--------------|
| R0.1 | **Migrar la DB a Neon** (dump/restore + `DATABASE_URL` en Render) y validar `alembic upgrade head` | bajo | acceso a Render/Neon |
| R0.2 | **Backups automatizados** (Neon los da; documentar restore en DEPLOY.md) | bajo | R0.1 |
| R0.3 | **CI en GitHub Actions**: workflow que corre `pytest -q`, `tsc --noEmit` y `npm run build` como checks obligatorios de PR | bajo | ninguna |

## R1 — Listos para usuarios reales (1 semana) 🟠

*Cierra el checklist go-live de seguridad/operación.*

| # | Tarea | Esfuerzo | Dependencias |
|---|-------|----------|--------------|
| R1.1 | **Sentry** (backend+frontend) + logging estructurado JSON con `request_id` | medio | — |
| R1.2 | **Sesiones revocables**: tabla de refresh tokens (jti), logout server-side, rotación en refresh — **ADR-0002** | medio | — |
| R1.3 | **CSP** y endurecimiento de headers del frontend (next.config) | bajo | — |
| R1.4 | **Decisión `quantity`**: capar a 1 en UI+API (rápido) o asignación múltiple (tabla N–N, **ADR-0003**) | bajo / alto | decisión de producto |
| R1.5 | **Unit tests del scoring de matching** (casos límite: sin geo, radio, pesos) + **3–4 E2E Playwright** (login→postular→asignar→confirmar) en CI | medio | R0.3 |
| R1.6 | **Interruptor de demo**: apagar `SEED_DEMO_DATA` y purgar cuentas demo al lanzar (runbook en DEPLOY.md) | bajo | momento del lanzamiento |

## R2 — Rendimiento y confianza del marketplace (1–2 semanas) 🟡

*Invisible con datos demo; imprescindible con cientos de usuarios.*

| # | Tarea | Esfuerzo | Dependencias |
|---|-------|----------|--------------|
| R2.1 | **Paginación** en todos los listados (feed, mine, inbox, admin users) | medio | — |
| R2.2 | **Fix N+1**: inbox de chat (query agregada) y postulantes (join/`in_`) | medio | — |
| R2.3 | **Matching acotado en SQL** (filtro por skill+disponibilidad+bbox en query; scoring en Python sobre el subconjunto) | medio | — |
| R2.4 | **Métricas de reputación reales**: `punctuality_rate`, `events_completed`, `cancellations` derivadas del ciclo del turno; reglas de insignias/niveles (BUSINESS_RULES.md) | alto | decisión de reglas |
| R2.5 | **Imágenes propias** (Cloudinary ya integrado) en lugar de loremflickr en seed/demo | bajo | — |

## R3 — Producto premium (en paralelo a R2 cuando R0–R1 cierren)

| # | Tarea | Esfuerzo | Dependencias |
|---|-------|----------|--------------|
| R3.1 | **Mapas F1–F3** ([MAPS_REDESIGN.md](./MAPS_REDESIGN.md), aprobado): base MapLibre vectorial → `/map` premium (40/60, clustering, sync) → `/search` + tiempos por modo + "cómo llegar" (deep-link) → desinstalar Leaflet | alto | diseño aprobado ✅ |
| R3.2 | DS v2 en pantallas Employer/Admin restantes | medio | — |

## R4 — Escala (cuando el tráfico lo pida, no antes)

| # | Tarea | Esfuerzo | Dependencias |
|---|-------|----------|--------------|
| R4.1 | 2+ workers ⇒ **Redis** para WS pub/sub y rate limiting — **ADR-0004** | alto | señal real de carga |
| R4.2 | Feed por **bbox** para multi-ciudad | medio | R2.3 |
| R4.3 | Mapas F4–F5 (rutas OSRM, geofencing, tracking) | alto | R3.1 |
| R4.4 | **Pagos MercadoPago** (entidad Payment, comisiones — ADR + fase 12 del master plan) | alto | decisión de negocio |

## Regla de oro

Ningún ítem de R4 se adelanta "por las dudas" (principio del repo: nada de
infraestructura pesada sin necesidad real y sin ADR). R0 no se negocia: es la
diferencia entre tener producto y tener un recuerdo.
