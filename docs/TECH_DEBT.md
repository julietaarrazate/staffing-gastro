# TECH_DEBT.md — Deuda técnica de Staffya (Fase 0)

> Catálogo de deuda con severidad y acción sugerida. Deriva de
> [AUDIT_REPORT.md](./AUDIT_REPORT.md). Las de bajo costo/alto valor están en
> [QUICK_WINS.md](./QUICK_WINS.md). Severidad: 🔴 alta · 🟠 media · 🟡 baja.

## Frontend — presentación

| # | Deuda | Sev | Acción sugerida |
|---|-------|-----|-----------------|
| F1 | **Dos sistemas de estados/encabezados**: `components/PageState.tsx` (EmptyState/PageHeader/CardSkeletons/ErrorBanner) vs `components/ui/` (EmptyState/Skeleton). | 🟠 | Unificar en `components/ui/`; migrar los ~6 usos de `PageState` y eliminarlo. |
| F2 | **~23 botones inline** con clases ad-hoc en vez del `Button` del DS. | 🟠 | Reemplazar por `Button`; prohibir botones sueltos (lint/convención). |
| F3 | **`SKILL_STYLES` (gradientes por rubro)** aún usado en `search`, `shifts/new`, `workers/[id]`; conviven con `SKILL_ACCENT` (monocromático nuevo). | 🟠 | Migrar los 3 usos a `SKILL_ACCENT` y **eliminar `SKILL_STYLES`**. |
| F4 | `<img>` en vez de `next/image` (7 usos; 0 de `next/image`). | 🟡 | Evaluar `next/image` (dominios remotos en `next.config`) o mantener `<img>` con `loading=lazy` (ya aplicado). |
| F5 | Warnings de lint conocidos (`react-hooks/exhaustive-deps` deshabilitado en `search`, `@next/next/no-img-element`). | 🟡 | Revisar dependencias de efectos; documentar excepciones. |

## Backend — negocio incompleto

| # | Deuda | Sev | Acción sugerida |
|---|-------|-----|-----------------|
| B1 | **`payment` es placeholder** (no procesa cobro; `mark-paid` sólo cambia estado). | 🔴 | Integrar MercadoPago (Fase 12 del master plan). Documentar flujo en `PAYMENTS.md`. |
| B2 | **Insignias/niveles sin lógica de otorgamiento** (`WorkerBadge`, `GamificationLevel` son catálogo presentacional). | 🟠 | Definir reglas de otorgamiento (o marcar explícito como pendiente) y calcularlas. |
| B3 | **Métricas de reputación derivadas sin fuente clara** (`punctuality_rate`, `events_completed`, `cancellations`): sólo el rating se recalcula (por reviews). | 🟠 | Definir cómo/ cuándo se actualizan a partir del ciclo del turno. |

## Backend — infraestructura / datos

| # | Deuda | Sev | Acción sugerida |
|---|-------|-----|-----------------|
| I1 | **Postgres free de Render expira a 90 días** (pérdida de datos). | 🔴 | Migrar a **Neon** (pasos en `backend/README.md`). |
| I2 | **PostGIS/Redis "previstos" pero no usados**; distancia por Haversine en Python. | 🟡 | Mantener simple hasta que el volumen lo justifique (Fase 13); registrar como ADR. |
| I3 | Sin **bus de eventos/outbox**: los efectos (notificaciones) ocurren dentro del caso de uso. | 🟡 | OK para el tamaño actual; si se necesita consistencia/async, ADR + `EVENTS.md`. |

## Seguridad (detalle en RECOMMENDATIONS / Fase 9)

| # | Deuda | Sev | Acción sugerida |
|---|-------|-----|-----------------|
| S1 | `jwt_secret_key` con **default inseguro** (`"cambiar-esto-en-produccion"`) y clave corta (warning `InsecureKeyLength`). | 🔴 | Exigir secret por env (fallar el arranque si es el default en prod); clave ≥ 32 bytes. |
| S2 | **Sin rate limiting** (login y API). | 🟠 | Rate limit en auth y endpoints sensibles. |
| S3 | **Sin security headers / CSP**. | 🟠 | Headers (CSP, HSTS, X-Content-Type-Options, etc.). |
| S4 | **Sin logging estructurado / auditoría**. | 🟠 | Logging con contexto (usuario, request id) y trazas de acciones sensibles. |
| S5 | Límites de conexión/mensajes por WebSocket ausentes. | 🟡 | Cuotas por usuario/turno. |

## Tests / calidad

| # | Deuda | Sev | Acción sugerida |
|---|-------|-----|-----------------|
| T1 | Helper `_auth_headers` **duplicado en ~18 archivos** de test. | 🟡 | Extraer a fixture en `tests/conftest.py`. |
| T2 | **Sin tests de frontend** (sólo `tsc` + `build`) y **sin E2E**. | 🟠 | Unit/integration (Vitest/RTL) + E2E (Playwright) — Fase 8. |
| T3 | Sin medición de performance/Lighthouse en CI. | 🟡 | Añadir a CI (Fase 7). |

## Deuda "no repo" (entorno)

- El servidor de dev de Next deja procesos huérfanos ocupando el puerto 3000 en
  el entorno de trabajo (no afecta producción; molesta la iteración local).
