# ROADMAP — Hoja de ruta priorizada

> Fase 13 (final) de la auditoría OÍDO. Síntesis accionable de las 12 fases
> anteriores (`docs/audits/2026-08-oido/01_INVENTORY.md` a `docs/audits/2026-08-oido/12_DNDA.md`). Cada ítem cita
> la fase donde se originó — no se repite la evidencia acá, sólo la
> acción, el costo estimado, el tiempo y el riesgo. Ordenado por categoría
> según pide el mandato: **Crítico → Quick Wins → Alto Impacto → Deuda
> Técnica → Nice to Have**. Ningún ítem de este roadmap se ejecutó en esta
> auditoría — es el plan, no la implementación (mandato: "Recién cuando
> TODAS las auditorías estén completas... aplicar cambios pequeños, commit
> por commit").

## Cómo leer las columnas

- **Costo/Tiempo:** estimación gruesa en horas-persona de trabajo de
  código (no incluye QA/despliegue). "Operativo" = no es código, es una
  acción en un dashboard (Render/Vercel/Cloudinary) o una decisión de
  negocio/legal.
- **Riesgo:** de **hacer** el cambio (no de no hacerlo) — probabilidad de
  romper algo existente.

---

## 🔴 Crítico

| # | Ítem | Fase | Costo/Tiempo | Riesgo | Quién |
|---|---|---|---|---|---|
| C1 | ~~Apagar `SEED_DEMO_DATA` en Render antes de onboardear comercios reales~~ | `03_SECURITY.md §2` | Operativo, minutos | Bajo (ya hay runbook en `DEPLOY.md`) | ✅ Resuelto (2026-08-06, commit `879fbbe` #160): `render.yaml` → `value: "false"` |
| C2 | ~~Completar `Copyright [yyyy] [name]` en `LICENSE`~~ | `12_DNDA.md §1` | — | — | ✅ Resuelto (2026-08-04): Julieta Arrazate, 2026 |
| C3 | ~~Decidir si Apache 2.0 es la licencia querida~~ | `12_DNDA.md §2` | — | — | ✅ Resuelto (2026-08-04): reemplazada por licencia propietaria "All Rights Reserved" |

*Los 3 ítems críticos de esta auditoría están resueltos — verificado contra
el código real (commit `8b87269`, 2026-08-11) en la auditoría puntual de
2026-08-13, ver
[`../OBSERVABILITY_AND_PRODUCT_ANALYTICS.md §0`](../OBSERVABILITY_AND_PRODUCT_ANALYTICS.md#0-hallazgo-transversal-el-código-sigue-adelante-de-la-documentación).
No queda ningún hallazgo crítico abierto en ninguna de las dos auditorías.*

---

## ⚡ Quick Wins (bajo esfuerzo, alto valor de higiene)

| # | Ítem | Fase | Costo | Riesgo |
|---|---|---|---|---|
| Q1 | Corregir "expira a los 90 días"/"DB de Render" en 5 documentos (`ARCHITECTURE.md`, `DATABASE.md`, `SCALABILITY_REPORT.md`, `OBSERVABILITY.md`, `DEPLOY.md`) — un solo PR, mismo texto en los 5 lugares | `11_DOCUMENTATION.md §2` | 1-2h | Ninguno (sólo docs) |
| Q2 | Reescribir `docs/reference/OBSERVABILITY.md` desde el código real de `observability.py` (hoy dice que no existe algo que ya está en producción) | `06_INFRASTRUCTURE.md §1` | 1-2h | Ninguno |
| Q3 | Actualizar `docs/foundation/ARCHITECTURE.md`: Leaflet→MapLibre, agregar sección CI | `02_ARCHITECTURE.md §1` | 1h | Ninguno |
| Q4 | Corregir tabla de env vars de `docs/reference/DEPLOY.md` (`DATABASE_URL` ya no es `fromDatabase`) | `06_INFRASTRUCTURE.md §2` | 15min | Ninguno |
| Q5 | Completar la tabla de migraciones de `docs/reference/DATABASE.md` (11 sin registrar) y corregir el estado de `quantity` (ADR-0003, ya no "pendiente") | `05_DATABASE.md §1-2` | 1h | Ninguno |
| Q6 | Actualizar `README.md`: mencionar el rebrand a Oído, sacar Redis/PostGIS del stack listado, sumar PWA/push/Sentry/Cloudinary/Mercado Pago/Google Sign-In | `01_INVENTORY.md §7` | 1-2h | Ninguno |
| Q7 | Corregir conteos de `CLAUDE.md` (255 tests backend, no 218; 25 E2E en 14 specs, no 19 en 10) | `01_INVENTORY.md §3` | 15min | Ninguno |
| Q8 | Refrescar el encabezado de `CLAUDE.md` sobre el barrido de responsive (3 pantallas ya resueltas: `/my-shifts`, `/chats`, `/profile`) | `07_FRONTEND.md §5` | 15min | Ninguno |
| Q9 | `/admin/stats`: reemplazar el conteo en Python por `GROUP BY`/`func.count()` en SQL (P5) | `04_PERFORMANCE.md §2` | 1-2h | Bajo |
| Q10 | Agregar `RateLimiter` a `/auth/refresh` (mismo patrón que login/register) | `03_SECURITY.md §5` | 30min | Bajo |
| Q11 | Verificar en el dashboard de Cloudinary que el preset unsigned tenga límite de tamaño/formato configurado | `03_SECURITY.md §11` | Operativo, minutos | Ninguno | Julieta |
| Q12 | Decidir: mover `WorkerSkill` a `app/core/` o documentar la excepción en `ARCHITECTURE.md` (cruce de dominio `shift`/`matching`→`worker`) | `02_ARCHITECTURE.md §3` | 1-3h | Bajo (es un `Enum`, sin lógica) |
| Q13 | Eliminar o adoptar `SearchInput`/`FAB`/`Chip` del Design System (sin consumidores) | `09_CLEANUP.md §4` | 30min (eliminar) | Muy bajo (evidencia ya reunida) |
| Q14 | Decidir el destino de la config de `ruff` en `pyproject.toml` (sumarla a CI o quitarla si no se va a usar) | `01_INVENTORY.md §7` | 1h (sumar a CI) / 5min (quitar) | Bajo |

**Subtotal Quick Wins: ~10-16 horas**, casi todo documentación + 2-3
cambios de código triviales.

---

## 🎯 Alto impacto (más esfuerzo, justificado por el riesgo que mitigan)

| # | Ítem | Fase | Costo | Riesgo |
|---|---|---|---|---|
| H1 | ~~Cuota/rate limit en WebSockets (chat + notificaciones)~~ — ✅ Resuelto (2026-08-10, PR #196): `_ws_frame_rate_limit` en `notification/api/routes.py` y `chat/api/routes.py` | `03_SECURITY.md §8` | 4-8h | Medio (toca `ws_manager.py`, superficie usada en producción) |
| H2 | Instrumentar logging de eventos de seguridad (login fallido, 403, 429, acciones de admin) — la plomería (`request_id`+JSON+Sentry) ya existe | `03_SECURITY.md §10` | 4-6h | Bajo |
| H3 | Flujo de verificación de email (`/auth/verify-email`) | `03_SECURITY.md §9` | 1-2 días (requiere proveedor de email, ya integrado vía Resend) | Medio |
| H4 | Migrar los 11 usos de `<img>` a `next/image` + `images.remotePatterns` para Cloudinary | `04_PERFORMANCE.md §2` | 4-8h | Bajo-medio |
| H5 | 3 diagramas Mermaid (módulos, máquina de estados del turno, infraestructura) embebidos en `docs/` | `11_DOCUMENTATION.md §5` | 3-6h | Ninguno |
| H6 | Reorganizar `docs/` en subcarpetas temáticas (`reference/`, `audits/`, `planning/`) con actualización de links | `10_REPOSITORY.md §3` | 4-8h (46 archivos con links cruzados) | Bajo (mecánico, pero volumen alto) |
| H7 | Documentar (y decidir si mitigar) que el scheduler in-process comparte la asunción de instancia única con rate limiting/WS — sumarlo a `SCALABILITY_REPORT.md` | `08_BACKEND.md §3` | 1h (doc) / días (mitigar con lock distribuido, sólo si se escala a 2+ instancias) | Bajo (doc) |

**Subtotal Alto Impacto: ~3-5 días** de trabajo real de código +
documentación.

---

## 🏗️ Deuda técnica (ya catalogada, se agrega la vista consolidada)

Estos ítems **ya están documentados** en `docs/TECH_DEBT.md`/
`docs/audits/PERFORMANCE_REPORT.md` con su propio análisis de esfuerzo/riesgo —
no se re-estiman acá, sólo se listan para que este roadmap sea el punto de
entrada único:

- **S1:** ~~migrar refresh token de `localStorage` a cookie `httpOnly`~~ —
  ✅ Resuelto (2026-08-08, commit `782bdae` #172): `identity/api/routes.py`
  ya setea `httponly=True`.
- **Starlette 0.41→1.x / FastAPI / pytest 8→9:** saltos de versión mayor
  con CVEs de bajo riesgo actual — diferido a propósito, requiere ciclo de
  test dedicado (`docs/TECH_DEBT.md` S3).
- **Commit por repositorio, no por caso de uso** — cambio transversal a
  ~9 módulos, requiere una ronda dedicada bien probada
  (`04_PERFORMANCE.md §1`).
- **`CHECK` constraints faltantes** (`quantity>0`, `pay_amount>=0`,
  `end_at>start_at`) — bajo esfuerzo, bajo riesgo, no urgente mientras
  todo el acceso pase por el dominio (`05_DATABASE.md §3`).
- **SWR/React Query** en el frontend — cambio transversal a todas las
  pantallas, esfuerzo medio (`04_PERFORMANCE.md §2`).
- **Renombrar el módulo `application`** a algo menos ambiguo — esfuerzo
  medio, beneficio sólo de legibilidad, no urgente (`10_REPOSITORY.md §4`).

---

## ✨ Nice to have

| # | Ítem | Fase | Costo | Riesgo |
|---|---|---|---|---|
| N1 | `Content-Security-Policy` más estricta (nonces en vez de `'unsafe-inline'`) | `03_SECURITY.md §4` | 1-2 días | Medio (requiere middleware propio en Next.js) |
| N2 | Requisito mínimo de complejidad de contraseña | `03_SECURITY.md §9` | 1-2h | Bajo |
| N3 | Migrar token WS de query string a subprotocolo `Sec-WebSocket-Protocol` | `03_SECURITY.md §8` | Medio (cambia contrato del cliente WS) | Medio |
| N4 | Gate de auth en `/docs`/`/redoc` en producción (o decisión explícita de dejarlo abierto) | `08_BACKEND.md §2` | 1-2h | Bajo |
| N5 | Incrementar `version` de la API más allá de `0.1.0` cuando haya un cambio de contrato real | `08_BACKEND.md §2` | Minutos | Ninguno |
| N6 | Virtualización de listas largas (acoplado a que el volumen real lo justifique) | `04_PERFORMANCE.md §2` | Medio | Bajo |
| N7 | Cache-Control en endpoints de catálogo poco volátil | `04_PERFORMANCE.md §4` (heredado de `PERFORMANCE_REPORT.md`) | Bajo | Bajo |
| N8 | Terminar el barrido de responsive/desktop: `/shifts/new`, `/shifts/[id]/candidates`, `/workers/[id]`, `/companies/[id]`, `/subscription`, `/admin` (6 pantallas) | `07_FRONTEND.md §5` | ~1 PR por pantalla, ya con el patrón resuelto en las 7 anteriores | Bajo (patrón ya probado) |
| N9 | Mejorar cobertura de `focus-visible` fuera de los componentes del DS | `07_FRONTEND.md §4` | Medio (disperso) | Bajo |

---

## Resumen ejecutivo del roadmap

- **3 ítems críticos, los 3 resueltos** (última verificación: 2026-08-13,
  commit `8b87269`) — C1 era operativo (Render), C2/C3 eran decisiones de
  Julieta/legal. **No hay ningún hallazgo crítico abierto en el repo.**
- **14 quick wins**, ~10-16 horas en total, en su mayoría documentación
  (el hallazgo transversal de toda esta auditoría: el código está más
  sano que su documentación — confirmado de nuevo el 2026-08-13, ver
  [`../OBSERVABILITY_AND_PRODUCT_ANALYTICS.md §0`](../OBSERVABILITY_AND_PRODUCT_ANALYTICS.md)).
- **7 ítems de alto impacto**: **H1 (cuota de WebSockets) resuelto**
  (2026-08-10); quedan 6, con el logging de seguridad (H2) como el de
  mayor relación riesgo-mitigado/esfuerzo — nota: el mecanismo técnico
  que pide H2 (logging estructurado de eventos) ya se instrumentó para
  eventos de **producto** (`shift.published`, `application.submitted`,
  etc.) en la auditoría de 2026-08-13; falta el mismo tratamiento para
  eventos de **seguridad** (login fallido, 403, 429, acciones de admin),
  que sigue siendo H2 tal cual.
- **6 ítems de deuda técnica** ya catalogados en `TECH_DEBT.md`, sin
  necesidad de re-priorizar — se referencian, no se duplican.
- **9 ítems nice-to-have**, incluida la cola del barrido de responsive
  (6 pantallas, patrón ya resuelto y probado en las 7 anteriores).

**Ningún hallazgo de esta auditoría de 13 fases cambia el veredicto ya
vigente** de `docs/planning/LAUNCH_PLAN.md` (lista para beta cerrada con usuarios
reales) — lo que sí cambia es la lista concreta de qué hacer antes de
escalar más allá de la beta, consolidada acá en un solo lugar por primera
vez.

## Ver también

- [`../OBSERVABILITY_AND_PRODUCT_ANALYTICS.md`](../OBSERVABILITY_AND_PRODUCT_ANALYTICS.md) —
  auditoría puntual (2026-08-13) de observability, business events y
  métricas de producto (`shift_fill_rate`, `application_to_acceptance_rate`,
  `no_show_rate`, tasas de repetición) — implementadas en esa misma sesión.
- [`../MATCHING_QUALITY_ANALYSIS.md`](../MATCHING_QUALITY_ANALYSIS.md) —
  análisis del motor de matching + diseño mínimo propuesto (no
  implementado) para medir si el ranking predice la selección real.
