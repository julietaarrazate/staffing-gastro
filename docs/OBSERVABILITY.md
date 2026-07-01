# OBSERVABILITY.md — Observabilidad (arquitectura técnica)

> Cómo se ve qué está pasando en producción. **Estado honesto: mínimo.** Este
> documento describe lo que hay y, sobre todo, lo que falta.

## Estado actual (realidad del código)

- **Healthcheck:** `GET /health` → `{"status":"ok","service":"Staffya"}`. Es lo
  que Render usa para saber si el servicio está vivo (`healthCheckPath`). Ver
  [DEPLOY.md](./DEPLOY.md).
- **Logs:** salida estándar del proceso (uvicorn/SQLAlchemy). Con `DEBUG=true`,
  SQLAlchemy loguea el SQL (`engine echo=settings.debug`); en producción
  (`DEBUG=false`) queda silencioso. Los logs viven en el dashboard de Render.
- **Sin** métricas, tracing distribuido, APM, ni alertas configuradas.
- **Sin** logging estructurado ni correlación de requests.

## Qué falta (a construir — Fase de Observabilidad)

> Priorizar por costo/beneficio para la escala actual (un solo servicio):
>
> 1. **Logging estructurado** (JSON) con nivel configurable y un `request_id`
>    por request para correlacionar. Hoy es texto plano.
> 2. **Errores capturados** (Sentry o equivalente) con contexto — hoy un 500 sólo
>    aparece en los logs de Render.
> 3. **Métricas básicas** de negocio y sistema: turnos publicados/cubiertos,
>    tiempo a cubrir (¿se cumple la meta de < 10 min?), latencia de endpoints,
>    tasa de error. Ver métricas de dominio en [REPUTATION.md](./REPUTATION.md) y
>    el endpoint `/admin/stats` como punto de partida.
> 4. **Alertas** sobre el healthcheck y sobre la expiración de la DB (90 días,
>    ver [DATABASE.md](./DATABASE.md)).
> 5. **Trazas de WebSocket** (conexiones activas, reconexiones) — hoy el
>    `ws_manager` no expone métricas.

## Principio

La observabilidad debe crecer **con necesidad real**, sin introducir
infraestructura pesada por adelantado (coherente con
[PRINCIPLES.md](./PRINCIPLES.md) y [CLAUDE.md](../CLAUDE.md#no-hacer)). Cualquier
herramienta externa (APM, agregador de logs) que agregue infra o costo relevante
se decide con un **ADR**.
