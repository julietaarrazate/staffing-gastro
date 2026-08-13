# OBSERVABILITY.md — Observabilidad (arquitectura técnica)

> Cómo se ve qué está pasando en producción. **Estado (actualizado
> 2026-08-04, auditoría OÍDO):** hay una base real de logging estructurado y
> captura de errores en producción — no es el "mínimo, sin nada" que
> describía la versión anterior de este documento. Sigue faltando la capa
> de métricas de negocio/sistema, alertas propias y trazas de WebSocket.

## Estado actual (realidad del código)

- **Healthcheck:** `GET /health` (responde a `GET` y `HEAD`, ver comentario
  en `app/main.py` sobre un incidente real con un monitor externo que
  reportaba el servicio caído por sólo aceptar `GET`) →
  `{"status":"ok","service":"Oído"}`. Es lo que Render usa para saber si el
  servicio está vivo (`healthCheckPath`). Ver [DEPLOY.md](./DEPLOY.md).
- **Logging estructurado con `request_id`:** `backend/app/core/observability.py`
  (`RequestIdMiddleware` + `setup_logging()`). Cada request recibe un
  `request_id` (propio o el `X-Request-ID` entrante), disponible en un
  `ContextVar` y devuelto en la respuesta. Con `LOG_JSON=true` (pensado para
  Render) los logs salen en JSON con `request_id` correlacionado; en
  desarrollo, texto plano legible. Cableado en `app/main.py` (`setup_logging()`,
  `RequestIdMiddleware` como middleware global).
- **Errores capturados (Sentry):** `setup_sentry()`, mismo archivo, inicializa
  Sentry **sólo si `SENTRY_DSN` está configurado** (no-op sin la env var, mismo
  patrón "flag por ausencia" que el resto del repo — el código ya está
  mergeado y puede desplegarse antes de tener la cuenta). Backend
  (`sentry-sdk[fastapi]`) y frontend (`@sentry/nextjs`, con import dinámico
  gateado por DSN para no pesar el bundle sin necesidad, ver
  `docs/audits/PERFORMANCE_AUDIT_FRONTEND.md §1.3`).
- **Logs de proceso:** además de lo estructurado arriba, sigue habiendo
  salida estándar del proceso (uvicorn/SQLAlchemy). Con `DEBUG=true`,
  SQLAlchemy loguea el SQL (`engine echo=settings.debug`); en producción
  (`DEBUG=false`) queda silencioso. Los logs viven en el dashboard de Render.

## Business events de producto (2026-08-13)

`_JsonFormatter` (`app/core/observability.py`) ahora mergea los campos de
`extra=` bajo una clave `data` en el JSON — antes se descartaban en
silencio. Sobre esa base, `shift/application/services.py` y
`application/application/services.py` instrumentan los hitos del dominio:
`shift.published`, `shift.escalated`, `shift.cancelled`, `shift.assigned`,
`worker.no_show` (con `trigger=manual|automatic`), `application.submitted`,
`application.accepted`, `application.rejected`, `application.withdrawn`.
Cada uno loguea `shift_id`/`worker_profile_id`/`company_id` según
corresponda. Ver el detalle completo (fuente, señales, y las 5 métricas de
producto que se construyeron encima) en
[`docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md`](../audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md).

## Qué falta (a construir)

> Priorizar por costo/beneficio para la escala actual (un solo servicio):
>
> 1. **Eventos de seguridad instrumentados.** La plomería (`request_id` +
>    JSON + Sentry) ya existe, y ya se usó para instrumentar eventos de
>    **producto** (ver arriba) — pero ningún módulo llama a
>    `logger.warning`/`logger.error` en un login fallido, un 403 por rol
>    insuficiente, un 429 de rate limit, o una acción de moderación de admin
>    (suspender/activar/promover usuario). Sigue siendo el ítem de mayor
>    relación valor/esfuerzo pendiente en la dimensión de **seguridad** — ver
>    `docs/audits/2026-08-oido/03_SECURITY.md §10` de la auditoría OÍDO.
> 2. **Métricas de negocio agregadas — resuelto en parte (2026-08-13).**
>    `GET /admin/stats` ya expone `avg_time_to_fill_minutes`/
>    `pct_filled_under_10_min` (tiempo a cubrir, meta < 10 min) y, desde esta
>    fecha, `shift_fill_rate_pct`, `application_to_acceptance_rate_pct`,
>    `no_show_rate_pct`, `worker_completion_repeat_rate_pct`,
>    `employer_repeat_rate_pct` — todas derivadas de columnas ya existentes
>    (sin tabla nueva). Ver
>    [`docs/audits/ETAPA1_QUALITY_REVIEW.md`](../audits/ETAPA1_QUALITY_REVIEW.md)
>    para la definición exacta de cada una (numerador/denominador/qué queda
>    afuera) — 4 de las 5 miden con precisión lo que su nombre sugiere;
>    `shift_fill_rate_pct` mide "encontró candidato alguna vez", no
>    "terminó cubierto exitosamente" (hallazgo abierto, sin resolver
>    todavía). Falta latencia de endpoints y tasa de error (fuera de
>    alcance de esta ronda: requeriría un middleware de timing, no
>    cubierto todavía).
> 3. **Alertas propias** sobre el healthcheck y sobre errores capturados por
>    Sentry (hoy, sin `SENTRY_DSN` configurado en producción, no hay alerta
>    activa más allá del monitor externo de uptime que ya existe — ver nota
>    abajo). Nada de esto vive en código, es configuración de la
>    plataforma/servicio elegido.
> 4. **Trazas de WebSocket** (conexiones activas, reconexiones) — hoy el
>    `ws_manager` no expone métricas.
> 5. **Calidad del matching** (¿el ranking predice quién termina
>    seleccionado?) — analizado pero deliberadamente no implementado, ver
>    [`docs/audits/MATCHING_QUALITY_ANALYSIS.md`](../audits/MATCHING_QUALITY_ANALYSIS.md).

## Nota: ya existe un monitor de uptime externo

No es parte del código (vive en la configuración de un servicio externo,
no en este repo), pero conviene que quede registrado acá: hay un monitor
de uptime (tipo UptimeRobot) sondeando `/health` en producción — ya generó
y ayudó a resolver un incidente real (el healthcheck no respondía a `HEAD`,
ver comentario en `app/main.py`). No reemplaza las alertas de negocio del
punto 3 de arriba, pero significa que "cero alertas" no es del todo exacto:
ya hay una señal externa de disponibilidad corriendo.

## Principio

La observabilidad debe crecer **con necesidad real**, sin introducir
infraestructura pesada por adelantado (coherente con
[PRINCIPLES.md](../foundation/PRINCIPLES.md) y [CLAUDE.md](../../CLAUDE.md#no-hacer)). Cualquier
herramienta externa (APM, agregador de logs) que agregue infra o costo relevante
se decide con un **ADR**.
