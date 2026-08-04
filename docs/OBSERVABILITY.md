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
  `docs/PERFORMANCE_AUDIT_FRONTEND.md §1.3`).
- **Logs de proceso:** además de lo estructurado arriba, sigue habiendo
  salida estándar del proceso (uvicorn/SQLAlchemy). Con `DEBUG=true`,
  SQLAlchemy loguea el SQL (`engine echo=settings.debug`); en producción
  (`DEBUG=false`) queda silencioso. Los logs viven en el dashboard de Render.

## Qué falta (a construir)

> Priorizar por costo/beneficio para la escala actual (un solo servicio):
>
> 1. **Eventos de seguridad instrumentados.** La plomería (`request_id` +
>    JSON + Sentry) ya existe, pero ningún módulo llama a
>    `logger.warning`/`logger.error` en un login fallido, un 403 por rol
>    insuficiente, un 429 de rate limit, o una acción de moderación de admin
>    (suspender/activar/promover usuario). Es el ítem de mayor
>    relación valor/esfuerzo pendiente — ver `AUDIT/03_SECURITY.md §10` de
>    la auditoría OÍDO.
> 2. **Métricas básicas** de negocio y sistema: turnos publicados/cubiertos,
>    tiempo a cubrir (¿se cumple la meta de < 10 min?), latencia de
>    endpoints, tasa de error. Ver métricas de dominio en
>    [REPUTATION.md](./REPUTATION.md) y el endpoint `/admin/stats` como
>    punto de partida.
> 3. **Alertas propias** sobre el healthcheck y sobre errores capturados por
>    Sentry (hoy, sin `SENTRY_DSN` configurado en producción, no hay alerta
>    activa más allá del monitor externo de uptime que ya existe — ver nota
>    abajo). Nada de esto vive en código, es configuración de la
>    plataforma/servicio elegido.
> 4. **Trazas de WebSocket** (conexiones activas, reconexiones) — hoy el
>    `ws_manager` no expone métricas.

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
[PRINCIPLES.md](./PRINCIPLES.md) y [CLAUDE.md](../CLAUDE.md#no-hacer)). Cualquier
herramienta externa (APM, agregador de logs) que agregue infra o costo relevante
se decide con un **ADR**.
