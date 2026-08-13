# OBSERVABILITY_AND_PRODUCT_ANALYTICS.md — Auditoría de observability, business events y métricas de producto

> Auditoría puntual (2026-08-13), scopeada a observability/business
> events/product analytics/matching quality — lo que pidió Julieta. **No
> repite** la auditoría de 13 fases de `docs/audits/2026-08-oido/` (2026-08-04,
> commit base `812c114`) ni su `ROADMAP.md`: donde ese trabajo ya cubre algo
> (seguridad, base de datos, arquitectura), esta auditoría lo referencia en
> vez de re-derivarlo. Se enfoca en lo que esa auditoría **no** cubrió:
> eventos de negocio como capa de logging, calidad del matching, y métricas
> de producto más allá de `time_to_cover` (que ya existe). Metodología:
> lectura directa del código real contra el commit `8b87269` (2026-08-11),
> una semana posterior al commit base de la auditoría de 13 fases — se
> señala explícitamente cada vez que el código avanzó más que esa
> documentación.

## 0. Hallazgo transversal: el código sigue adelante de la documentación

Antes de listar gaps, un hecho verificado que cambia la lectura de
`docs/audits/2026-08-oido/ROADMAP.md`: **3 de sus ítems ya listados como
abiertos están resueltos en el código actual**, con commits posteriores a
esa auditoría:

| Ítem del ROADMAP | Estado en el ROADMAP | Estado real verificado | Commit |
|---|---|---|---|
| C1 — `SEED_DEMO_DATA=true` en producción (🔴 Crítico) | Abierto | **Resuelto** — `render.yaml:47-48`: `value: "false"` | `879fbbe` (2026-08-06) |
| Deuda S1 — refresh token en `localStorage` (🟠 Alto) | Abierto | **Resuelto** — cookie `httponly=True` (`identity/api/routes.py:90-110`) | `782bdae` (2026-08-08) |
| H1 — sin cuota en WebSockets (🟡 Medio) | Abierto | **Resuelto** — `_ws_frame_rate_limit` en `notification/api/routes.py:41,98` y `chat/api/routes.py:49,129` | `#196` (2026-08-10) |

**Implicancia práctica:** el único ítem crítico que quedaba abierto en todo
el repo ya no lo está. No hay ningún hallazgo de severidad crítica vigente
en esta auditoría ni en la anterior. Se recomienda un PR de una línea que
actualice `ROADMAP.md` (tachar C1/S1/H1 con fecha de resolución) — evita que
el próximo lector repita este mismo trabajo de verificación.

---

## 1. Estado actual (lo que ya existe — no se duplica)

### 1.1 Observabilidad técnica (plomería)

- **`request_id` correlacionado** en cada request (`app/core/observability.py`
  `RequestIdMiddleware`), propio o `X-Request-ID` entrante, vía `ContextVar`,
  devuelto en la respuesta.
- **Logging estructurado JSON** (`setup_logging()`, `LOG_JSON=true` para
  Render) con `request_id` en cada línea; texto legible en desarrollo.
- **Sentry backend + frontend**, no-op sin `SENTRY_DSN` (`sentry-sdk[fastapi]`
  backend; `@sentry/nextjs` con `frontend/instrumentation.ts` +
  `instrumentation-client.ts`, import gateado por DSN). `traces_sample_rate=0.0`
  (sólo errores, sin performance tracing) y `send_default_pii=False`.
- **Healthcheck** `GET/HEAD /health`, usado por un monitor de uptime externo
  ya en producción (tipo UptimeRobot).
- **Idempotencia real** en mutaciones críticas (`app/core/idempotency.py`):
  header `Idempotency-Key`, tabla `idempotency_keys`, TTL 24h. Cableada en
  `shift`, `application`, `review` y `subscription` (`grep
  "Depends(idempotent)"` → esos 4 módulos, confirmado).
- **Rate limiting** (`app/core/rate_limit.py`, en memoria/por proceso) en 13+
  endpoints: login, register, forgot-password, google-auth, guest,
  refresh, resend-verification (identity); parse-shift-text (shift);
  frames WS de notification y chat; send-message de chat; assistant query;
  create-ticket/send-message/ai-suggestion de support.
- **Security headers + CSP** en producción (`SecurityHeadersMiddleware`,
  `frontend/next.config.ts`).

**Veredicto:** la plomería de observabilidad técnica está más completa que
lo que suele existir en un MVP de 2 meses. No hace falta agregar Prometheus,
Grafana ni ningún APM — sería infraestructura sin necesidad real (viola
`docs/foundation/PRINCIPLES.md #10`).

### 1.2 Métrica de producto que YA existe: `time_to_cover`

`GET /admin/stats` (`admin/application/services.py:64-92`) ya calcula, en
SQL + Python sobre `shifts.published_at`/`first_assigned_at`
(migración `0020`, sin backfill — sólo turnos publicados después de
2026-08-02):

- `avg_time_to_fill_minutes` — tiempo promedio entre publicar y primera
  asignación.
- `pct_filled_under_10_min` — % de turnos cubiertos bajo la meta de producto
  (`PRINCIPLES.md #1`: "cubrir un turno en < 10 minutos").
- `coverage_sample_size` — tamaño de muestra (para no mostrar el % con 2
  turnos como si fuera confiable).

Esto responde **directamente** una de las preguntas del criterio de éxito
("¿Cuánto tarda en cubrir un turno?"). No se re-implementa: se extiende
(§6).

### 1.3 Contadores de reputación (materia prima sin agregar)

`WorkerProfile`/`CompanyProfile` ya llevan contadores reales, actualizados
en los puntos de transición del dominio (no en background jobs):
`rating`, `punctuality_rate`, `events_completed`, `cancellations`,
`no_shows` (trabajador); `rating`, `on_time_payment_rate`,
`events_published`, `late_cancellations` (comercio). Están descriptos con
precisión en `docs/reference/REPUTATION.md`. **Son la materia prima** para
`no_show_rate` y varias métricas de producto — hoy viven por-entidad, no
agregadas a nivel plataforma (§6).

### 1.4 Testing y CI

- **Backend:** 34 archivos de test, `pytest -q` obligatorio en CI
  (`.github/workflows/ci.yml`), incluido `test_full_shift_lifecycle.py`
  (ciclo completo turno→reseña→reputación→ranking, a nivel API).
- **Frontend:** `tsc --noEmit`, `npm run test:unit`, `npm run build`
  obligatorios en CI.
- **E2E:** 25 specs de Playwright (`frontend/e2e/`), CI obligatorio con
  Chromium, artifact de reporte en fallos. Cobertura real incluye
  onboarding (guest y registrado), guided tours, foco/teclado en diálogos
  (`focus-trap.spec.ts`), favoritos, chat, mapa, suscripción, feed con
  filtro de urgencia.
- **CI con path-filtering** (`dorny/paths-filter`): un PR que sólo toca
  frontend no paga el job de backend y viceversa — bien pensado, no es un
  gap.

**Veredicto:** la base de testing es sólida y ya gatea cada PR. El gap real
no es "faltan tests", es cobertura de **flujos cross-persona específicos**
(§7) y de **a11y automatizado** (§8).

### 1.5 Dependencias externas actuales (ninguna nueva a agregar)

| Servicio | Uso | Free tier | Crítico para runtime? |
|---|---|---|---|
| Sentry | Errores backend+frontend | Sí (10k eventos/mes) | No — no-op sin DSN |
| Resend | Email transaccional | Sí | Ver `notification/infrastructure/resend_email_sender.py` |
| Cloudinary | Fotos de perfil (upload directo del browser) | Sí | No — sólo feature de perfil |
| Google Sign-In | Auth alternativa | Sí, gratis | No — login por password sigue andando |
| Mercado Pago | Suscripciones (Fase 1) | Comisión por transacción, no fee fijo | Sólo módulo `subscription` |
| UptimeRobot (o similar) | Monitor externo de `/health` | Sí | No — sólo alerta |

Ninguna es nueva; todas ya están evaluadas y en uso. **No hay ningún SaaS de
analytics de producto hoy** (cero `gtag`/`posthog`/`plausible` en el
frontend, verificado por grep) — coincide exactamente con la restricción de
Julieta de no depender de terceros: hoy Oído no depende de ninguno para
medir su propio producto.

---

## 2. Gaps (lo que falta, verificado — no asumido)

### 2.1 🔴 Business events: cero instrumentación en los módulos de dominio

`grep -rn "logger\.\(info\|warning\|error\)"` en `shift/`, `application/`,
`matching/`, `worker/`, `review/` → **cero resultados** en los servicios de
aplicación. Los únicos `logger.*` de todo el backend de negocio están en
`notification/infrastructure/` (éxito/fallo de push, ya con try/except
correcto).

**Qué significa en la práctica:** cuando un turno se publica, se asigna, se
cancela, un no-show se marca, o una postulación se rechaza, el **estado
queda en la base de datos** (correcto, es la fuente de verdad) pero **no
queda ninguna línea de log correlacionable con `request_id`** que diga que
pasó. Si un trabajador dice "no me llegó la notificación del turno urgente
X", hoy la única forma de investigar es leer filas de tres tablas a mano
(`shifts`, `notifications`, `notification` logs de Resend/WebPush) — no hay
un rastro de auditoría legible cronológicamente.

Esto **no es lo mismo** que el hallazgo #10 de `03_SECURITY.md` (que habla
específicamente de eventos de **seguridad**: login fallido, 403, 429,
acciones de admin — también sigue abierto, verificado de nuevo con el mismo
grep). Son dos gaps hermanos, mismo fix (agregar `logger.info`/`.warning` en
los puntos ya existentes de la capa `application/`), pero con audiencias
distintas: seguridad audita accesos; esto audita el **funnel del producto**.

### 2.2 🔴 Calidad del matching: no se puede responder la pregunta central

`grep -rn "match_score\|MatchScore" backend/app/modules/matching` → **cero
resultados**. El scoring (`matching/domain/scoring.py`) calcula un score
puro por request (distancia + reputación + experiencia + puntualidad +
desempeño, pesos documentados en `docs/reference/MATCHING.md`) y lo devuelve
al comercio en `/shifts/{id}/candidates` — **pero no persiste ni loguea
nada**: ni qué candidatos se mostraron, ni con qué score, ni cuál terminó
asignado.

**Consecuencia directa:** hoy es **imposible** responder con datos la
pregunta que Julieta puso como criterio de éxito ("¿los candidatos que el
algoritmo prioriza son realmente los que terminan siendo
seleccionados/contratados?"). El dominio ya tiene todo lo necesario para
calcularlo el día que se instrumente (`ShiftApplication.status`, el ranking
en el momento de mostrarlo) — sólo falta guardarlo.

### 2.3 🟡 Métricas de producto más allá de `time_to_cover`: no existen agregadas

Verificado por grep (`fill_rate`, `repeat_rate`, `repeat_booking` → cero
resultados en todo `backend/app`) y por lectura de `admin/application/services.py`
(única fuente de métricas agregadas del repo, sólo tiene las 3 de §1.2).
Específicamente **no existen** hoy, a nivel plataforma:

- `shift_fill_rate` (% de turnos publicados que llegan a `ASIGNADO`+ antes
  de expirar/cancelarse, vs. total publicado).
- `time_to_first_application` (distinto de `time_to_cover`: cuánto tarda la
  **primera postulación**, no la primera asignación — señal de si el feed
  muestra el turno a tiempo, independiente de si el comercio tarda en
  elegir).
- `application_to_acceptance_rate` (de las postulaciones que llegan, qué %
  termina `ACEPTADA`).
- `no_show_rate` **agregado** (hoy `no_shows` es un contador por
  `WorkerProfile`, correcto para reputación individual, pero no hay un
  "% de turnos confirmados que terminan en no-show" a nivel plataforma).
- `worker_repeat_rate` / `employer_repeat_rate` (¿vuelve el mismo trabajador
  a tomar turnos? ¿vuelve el mismo comercio a publicar?) — no hay ninguna
  query ni concepto de "usuario recurrente" en el código.

Todas son **calculables sin tablas nuevas** con el esquema actual
(`ShiftStatus`, `ApplicationStatus`, timestamps ya existentes) — es trabajo
de query + endpoint, no de modelo de datos (§6).

### 2.4 🟡 A11y: verificado manualmente en puntos clave, sin barrido automatizado

`frontend/package.json` tiene `eslint-plugin-jsx-a11y` (lint estático) y
existe trabajo E2E real y deliberado: `focus-trap.spec.ts` prueba foco
atrapado en diálogos (`Modal`/`Sheet`), con un comentario que documenta el
bug real que motivó el spec (F1, auditoría 2026-08-09). Esto **no es
"nada"** — es evidencia de que a11y se toma en serio en los componentes de
mayor riesgo (diálogos modales). Lo que falta es un **barrido automatizado**
tipo `axe-core`/`jest-axe` que corra en CI sobre las pantallas completas
(no sólo el caso puntual que ya se arregló) — hoy nada en el repo ejecuta un
scan de accesibilidad de página completa.

### 2.5 🟢 E2E: falta el flujo cross-persona continuo (Flujo 1 completo)

Verificado leyendo los specs: `employer-wizard.spec.ts` prueba "un employer
publica un turno con el wizard mínimo" (una persona, hasta publicar).
`worker-apply.spec.ts` prueba "un worker ve un turno en el feed y se
postula" (otra persona, con datos mockeados vía `mocks.ts` — no depende del
primer spec). **Ningún spec de Playwright encadena ambas personas en un
solo flujo de browser** (publicar → aparece en el feed real → se postula →
el comercio ve la postulación → acepta). El equivalente **sí existe a nivel
API** en `backend/tests/test_full_shift_lifecycle.py`
(`test_full_review_cycle_closes_and_reputation_enters_matching_ranking`,
247 líneas, cubre creación de comercio+perfil, turno completo, reseña y
entrada al ranking) — es una cobertura real y fuerte, pero a nivel HTTP, no
de UI. El gap es específicamente la versión **de navegador**, que es la que
verificaría que el frontend realmente conecta las dos partes (no sólo que
el backend lo permite).

---

## 3. Riesgos

| # | Riesgo | Severidad | Por qué importa ahora |
|---|---|---|---|
| R1 | Sin logs de negocio, un incidente de producto (turno no cubierto, notificación no entregada) se investiga a mano, tabla por tabla | Media | Cuesta tiempo de Julieta/soporte por cada caso; escala mal con más usuarios reales en la beta |
| R2 | Sin instrumentación de matching, no hay forma de validar ni calibrar los pesos del scoring (`0.30` distancia, `0.25` reputación, etc. — hoy "valores semilla" según `MATCHING.md`) con datos reales | Media | Los pesos quedan como intuición para siempre si nunca se mide contra resultado real |
| R3 | Sin `fill_rate`/`no_show_rate` agregados, no hay forma de saber si la beta realmente funciona como marketplace más allá de "se ve bien" | Media | Es la pregunta que Julieta puso como criterio de éxito — sin esto, no se puede responder |
| R4 | `ROADMAP.md` desactualizado (§0) puede hacer que alguien re-investigue o re-implemente algo ya resuelto | Baja | Costo de tiempo, no de producto — mitigación es un PR de documentación |

Ningún riesgo de esta lista es crítico ni bloquea la beta — son gaps de
**aprendizaje**, no de **funcionamiento**. Coincide con el veredicto ya
vigente de `docs/planning/LAUNCH_PLAN.md` (lista para beta cerrada).

---

## 4. Quick wins (bajo esfuerzo, alto valor de aprendizaje)

| # | Ítem | Esfuerzo | Riesgo de romper algo |
|---|---|---|---|
| QW1 | Actualizar `ROADMAP.md`: tachar C1/S1/H1 con fecha y commit (§0) | 15 min | Ninguno (sólo doc) |
| QW2 | Agregar `logger.info` a los 6-8 puntos de transición ya existentes en `ShiftService`/`ApplicationService` (§5) | 3-4h | Bajo — no cambia lógica, sólo agrega logging al final de métodos ya probados |
| QW3 | Loguear el ranking de candidatos al momento de mostrarlo (`match.generated`) — un `logger.info` en el endpoint de `/shifts/{id}/candidates` | 1-2h | Muy bajo |
| QW4 | Extender `PlatformStats`/`/admin/stats` con `shift_fill_rate` (query adicional sobre `ShiftRepository`, mismo patrón que `list_recently_filled`) | 3-4h | Bajo — es sólo lectura agregada nueva |
| QW5 | E2E: un spec nuevo que encadene employer-wizard + worker-apply en un solo flujo de browser (reusando los dos ya existentes como referencia) | 3-5h | Ninguno — spec nuevo, no toca los existentes |

**Subtotal: ~11-16 horas**, todo reversible y sin tocar arquitectura.

---

## 5. Business events — tabla

> Todos son **efectos dentro del caso de uso existente** (coherente con
> `docs/reference/EVENTS.md`: no hay bus de eventos y no se propone crear
> uno). Se agrega **una línea de `logger.info`/`logger.warning`** en el
> punto donde el servicio de aplicación ya muta el estado — no se cambia
> ninguna lógica de negocio.

| Event | Source (archivo:método) | Persist? | Purpose |
|---|---|---|---|
| `shift.published` | `shift/application/services.py::publish_shift` | No (sólo log; el estado ya persiste en `shifts.published_at`) | Trazabilidad; base de `time_to_first_application` |
| `shift.assigned` | `shift/application/services.py::assign_worker` | No | Trazabilidad; ya alimenta `time_to_cover` vía `first_assigned_at` |
| `shift.cancelled` | `shift/application/services.py::cancel_shift` | No | Trazabilidad; distingue cancelación temprana de tardía (ya lo hace el dominio, falta el log) |
| `shift.expired` | scheduler (`shift/application/scheduler.py`) | No | Hoy sin log — necesario para `shift_fill_rate` (denominador de "no cubiertos") |
| `shift.escalated` | `shift/application/services.py` (ADR-0009) | No | Trazabilidad de la escalada automática de urgencia |
| `application.submitted` | `application/application/services.py::apply` | No | Base de `time_to_first_application` y `application_to_acceptance_rate` |
| `application.accepted` / `application.rejected` | mismo servicio | No | Base de `application_to_acceptance_rate` |
| `worker.no_show` | `shift/application/services.py::mark_no_show` (ADR-0007) | No (contador ya persiste en `WorkerProfile.no_shows`) | Trazabilidad puntual + insumo de `no_show_rate` agregado |
| `match.generated` | `matching/api/routes.py` (al servir `/shifts/{id}/candidates`) | **Sí, si se decide instrumentar §2.2** — tabla mínima `match_log(shift_id, candidate_id, score, shown_at)` | Única forma de responder si el ranking predice la selección real |
| `match.applied` | correlaciona con `application.submitted` sobre el mismo `shift_id`+`candidate_id` | No (se deriva cruzando `match_log` con `applications`) | Mide qué candidatos rankeados alto efectivamente se postulan |
| `notification.delivery_failed` | `notification/infrastructure/webpush_sender.py:71` (**ya existe**, verificado) | No | Ya cubierto — no es un gap |
| `auth.login_failed` / `auth.403` / `auth.429` | `identity/api/routes.py` (excepciones ya capturadas) | No | Ya identificado en `03_SECURITY.md §10` — mismo fix técnico que esta tabla, otra motivación (seguridad, no producto) |

**Nota sobre `match.generated`:** es el único evento de esta tabla que
propone una tabla nueva (`match_log`), porque el score es efímero (se
calcula y se descarta). Es una tabla chica, sin infraestructura nueva
(misma Postgres/SQLAlchemy de siempre), coherente con
`docs/foundation/PRINCIPLES.md #10`. Los demás son logs puros — el estado
de negocio ya vive en las tablas existentes.

---

## 6. Métricas de producto — tabla

| Metric | Definition | Source | Priority |
|---|---|---|---|
| `avg_time_to_fill_minutes` | Ya existe (§1.2) | `admin/application/services.py::get_stats` | ✅ Ya implementado |
| `pct_filled_under_10_min` | Ya existe (§1.2) | ídem | ✅ Ya implementado |
| `shift_fill_rate` | `count(shifts en ASIGNADO+ sin cancelar) / count(shifts PUBLICADO)` en una ventana | Nueva query sobre `ShiftRepository`, mismo patrón que `list_recently_filled` | 🔴 Alta — completa la pregunta "¿funciona como marketplace?" |
| `time_to_first_application` | `applications.created_at (mín. por turno) - shifts.published_at` | Requiere agregar índice/lectura sobre `ShiftApplication.created_at` + `shifts.published_at` (ambos ya existen) | 🟡 Media |
| `application_to_acceptance_rate` | `count(ApplicationStatus.ACEPTADA) / count(total postulaciones)` en ventana | `ApplicationRepository`, agregación nueva | 🟡 Media |
| `no_show_rate` (agregado) | `count(shifts con worker.no_show) / count(shifts CONFIRMADO+)` en ventana | Cruce `shifts` + evento `worker.no_show` (§5) o `WorkerProfile.no_shows` sumado | 🟡 Media |
| `worker_repeat_rate` | % de trabajadores con `events_completed >= 2` sobre total con `>= 1` | `WorkerProfileRepository`, agregación nueva | 🟢 Baja (útil para retención, no bloquea la beta) |
| `employer_repeat_rate` | % de comercios con `events_published >= 2` sobre total con `>= 1` | `CompanyProfileRepository`, agregación nueva | 🟢 Baja |
| **Matching quality** (`match_score` vs. selección real) | Correlación entre score al momento de mostrar y si ese candidato terminó `ACEPTADA` | Requiere `match_log` (§5) — sin esto, no calculable | 🔴 Alta — es la pregunta que Julieta marcó como "especialmente importante" |

> **Nota post-implementación (2026-08-13, actualizada tras revisión de
> calidad):** esta tabla es el plan *original*, previo a escribir código.
> La implementación real terminó difiriendo en 3 puntos, revisados a fondo
> en [`ETAPA1_QUALITY_REVIEW.md`](./ETAPA1_QUALITY_REVIEW.md): (1) ninguna
> métrica quedó con ventana temporal — todas son all-time; (2)
> `shift_fill_rate` se implementó primero como "¿tuvo `first_assigned_at`
> alguna vez?" (más laxo que "¿está ASIGNADO+ y no cancelado hoy?" que
> decía este plan) — hallazgo detectado en la revisión de calidad y **ya
> corregido**: se eliminó `shift_fill_rate_pct` del contrato y se
> reemplazó por `shift_assignment_rate_pct` (la fórmula laxa original, ahora
> con nombre honesto) + `shift_completion_rate_pct` (nueva, usa
> `FINALIZADO`/`PAGADO` — el estado real que este plan quería medir); (3)
> `worker_repeat_rate` se renombró a `worker_completion_repeat_rate` porque
> medía algo más específico que "retención" (el propio riesgo que esta fila
> ya anticipaba con la nota "útil para retención"). `time_to_first_application`
> **no se implementó** (seguía en el roadmap, Etapa 2). Leer
> `ETAPA1_QUALITY_REVIEW.md` para la definición exacta de lo que quedó
> implementado, no esta tabla.

**Todas** se exponen naturalmente extendiendo `PlatformStats`/`GET
/admin/stats`, que ya es el punto de entrada de métricas del panel de
admin — no se propone un endpoint ni un dashboard nuevo.

---

## 7. E2E coverage — tabla

| Flow | Existing | Missing | Priority |
|---|---|---|---|
| **Flujo 1** (employer publica → worker ve → se postula → employer acepta) | Backend: `test_full_shift_lifecycle.py` (API, completo). Frontend: `employer-wizard.spec.ts` (sólo publicar) + `worker-apply.spec.ts` (sólo postularse, con mocks, aislado) | Un spec de Playwright que encadene ambas personas en un solo flujo de browser real | 🟡 Media (el backend ya lo garantiza; el frontend es la capa que falta verificar de punta a punta) |
| **Flujo 2** (worker: registro → onboarding → feed → postularse) | `onboarding.spec.ts`, `guest-onboarding.spec.ts`, `guided-tour.spec.ts`, `worker-apply.spec.ts` — cada tramo cubierto por separado | Nada crítico; los tramos existen aunque en specs distintos | 🟢 Baja |
| **Flujo 3** (turno cubierto → finalizado → reseña) | Backend: cubierto en `test_full_shift_lifecycle.py`. Frontend: `shift-lifecycle-stepper.spec.ts` (UI del stepper de estados) | Spec de browser que llegue hasta dejar una reseña real (hoy no encontrado en `frontend/e2e/`) | 🟡 Media |

**Veredicto:** la cobertura de lógica de negocio (backend) es sólida en los
3 flujos. El gap consistente es la capa de **browser cross-persona** — cada
E2E de frontend prueba una persona a la vez con mocks, lo cual es válido y
rápido, pero no reemplaza tener al menos un spec de humo que una las dos
puntas reales.

---

## 8. Database integrity

**No se re-audita acá** — `docs/audits/2026-08-oido/05_DATABASE.md` (fase 5,
2026-08-04) ya hizo esta auditoría línea por línea contra las 21
migraciones reales, con veredicto: *"esquema sólido y consistente: FKs
correctas con política de borrado explícita, índices en columnas de filtro
reales, unicidad aplicada a nivel de base donde importa"*. Único patrón
ausente: `CHECK` constraints de rango numérico/fecha — catalogado ahí como
bajo riesgo mientras todo el acceso pase por el dominio (que es el caso
hoy). Releer ese documento en vez de duplicar su tabla acá.

**Relevante para esta auditoría específicamente** (no cubierto por
`05_DATABASE.md` porque es nuevo): si se instrumenta `match_log` (§5), su
diseño debe seguir el mismo patrón ya establecido en `idempotency_keys`
(`app/core/idempotency.py`) — UUID primary key, `ForeignKey(...,
ondelete="CASCADE")` hacia `shifts`/`users`, índice compuesto
`(shift_id, candidate_id)`. No introduce ningún patrón nuevo al esquema.

---

## 9. Dependencies

Ya cubierto en §1.5. Resumen para esta sección: **cero dependencias nuevas
propuestas** en todo este documento. `match_log` es una tabla en la misma
Postgres existente, no un servicio. Los business events (§5) son líneas de
`logger.info` sobre la plomería que ya existe (§1.1) — cero paquetes nuevos.

Si en algún momento se quisiera un dashboard visual de estas métricas más
allá de `/admin/stats` (hoy JSON crudo, consumible por el panel de admin
existente), la opción más alineada con "gratis + open source + sin
dependencia crítica" sería un panel propio en el frontend ya existente
(reusar el Design System de `components/ui/`) — **no** Grafana/Metabase,
que serían infraestructura nueva sin necesidad demostrada todavía. Se
documenta la alternativa, no se implementa (fuera de alcance hasta que
`/admin/stats` se quede corto).

---

## 10. Recommended roadmap

Ordenado por Impact × Urgency / Effort, agrupado en las mismas 3 etapas que
ya usa el repo (`docs/audits/2026-08-oido/ROADMAP.md` como precedente de
formato):

### Etapa 1 — Esta semana (~11-16h, todo reversible)
1. **QW1** — Actualizar `ROADMAP.md` con los 3 ítems ya resueltos (§0). 15 min.
2. **QW2** — Instrumentar business events en `shift`/`application` (§5, primeras 7 filas de la tabla). 3-4h.
3. **QW3** — Loguear `match.generated` al servir candidatos. 1-2h.
4. **QW4** — Agregar `shift_fill_rate` a `/admin/stats`. 3-4h.
5. **QW5** — Spec E2E cross-persona (Flujo 1 completo). 3-5h.

### Etapa 2 — Próximas 2 semanas
6. Tabla `match_log` + correlación score↔selección real (§5, §6) — el ítem
   de mayor valor de aprendizaje de todo este documento, pero necesita la
   Etapa 1 (QW3) como base.
7. `time_to_first_application`, `application_to_acceptance_rate`,
   `no_show_rate` agregado — 3 queries nuevas sobre `/admin/stats`.
8. Instrumentar eventos de seguridad (`03_SECURITY.md §10`, mismo mecanismo
   técnico que QW2, ya priorizado como H2 en el ROADMAP existente — se
   puede hacer en el mismo PR que QW2 por eficiencia, ya que toca los
   mismos archivos).

### Etapa 3 — Cuando haya volumen real para justificarlo
9. `worker_repeat_rate` / `employer_repeat_rate` — útil recién cuando haya
   suficientes usuarios con 2+ turnos para que el número signifique algo.
10. Barrido automatizado de a11y (axe-core en CI) — valioso, pero el gap
    hoy es cobertura amplia, no ausencia total (§2.4); no es bloqueante.
11. Dashboard visual sobre `/admin/stats` (§9) — sólo si el JSON crudo del
    panel de admin se queda corto en la práctica.

**No entra en ningún roadmap** (documentado explícitamente para que no se
reproponga): Prometheus, Grafana, event bus/broker, microservicios, ELK,
cualquier SaaS de analytics de producto pago. Ninguno tiene un problema real
que resolver hoy — agregarlos sería infraestructura sin necesidad,
exactamente lo que `docs/foundation/PRINCIPLES.md #10` pide evitar.

---

## Cómo leer este documento junto con el resto de `docs/audits/`

```
docs/audits/2026-08-oido/          → arquitectura, seguridad, DB, performance,
                                      frontend, testing (13 fases, 2026-08-04)
docs/audits/2026-08-oido/ROADMAP.md → plan priorizado de ESE trabajo
                                      (desactualizado en 3 ítems, ver §0)
docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md → ESTE documento: business
                                      events, matching quality, métricas de
                                      producto (2026-08-13)
```

Ningún hallazgo de este documento contradice el veredicto de
`docs/planning/LAUNCH_PLAN.md` (lista para beta cerrada) — es trabajo de
**aprendizaje sobre el producto en marcha**, no de bloqueo de lanzamiento.
