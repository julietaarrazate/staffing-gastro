# 06 — Infraestructura

> Fase 6 de la auditoría OÍDO. Cubre: Render, Vercel, Neon, Cloudinary,
> GitHub, GitHub Actions, Docker, health checks, logs, backups, secrets,
> variables, observabilidad. Metodología: contraste de
> [`docs/DEPLOY.md`](../docs/DEPLOY.md) y
> [`docs/OBSERVABILITY.md`](../docs/OBSERVABILITY.md) contra el código y la
> config real (`render.yaml`, `backend/Dockerfile`,
> `backend/app/core/observability.py`, `.github/workflows/ci.yml`).
> No repite lo ya inventariado en `01_INVENTORY.md §5-6`. Sin cambios de
> código.

## 1. Hallazgo principal: `docs/OBSERVABILITY.md` describe un sistema que ya no existe

Es el hallazgo de coherencia doc↔código más grande de toda la auditoría
hasta ahora. `docs/OBSERVABILITY.md` completo dice, sin matices: *"Estado
honesto: mínimo"*, *"Sin logging estructurado ni correlación de
requests"*, y lista como **pendiente a construir**:

1. "Logging estructurado (JSON) con... `request_id` por request" —
   **ya existe**: `backend/app/core/observability.py`
   (`RequestIdMiddleware` + `setup_logging()`, formato JSON con
   `request_id` correlacionado vía `ContextVar`), verificado y citado con
   evidencia en `03_SECURITY.md §10`.
2. "Errores capturados (Sentry o equivalente)" — **ya existe**:
   `setup_sentry()` en el mismo archivo, cableado en `main.py:35`,
   dependencias `sentry-sdk[fastapi]` (backend) y `@sentry/nextjs`
   (frontend) confirmadas en `01_INVENTORY.md §1`. No-op sin `SENTRY_DSN`
   (mismo patrón "flag por ausencia" del resto del repo), pero el código
   está completamente implementado, no es un plan.

Es decir: **2 de los 5 ítems que `OBSERVABILITY.md` lista como "a
construir" ya están construidos.** El documento no se actualizó cuando se
implementó R1.1 (observabilidad). Esto no es un matiz — es la clase de
inconsistencia doc↔código que el checklist de `CLAUDE.md` (ítem 4) pide
frenar y corregir antes de seguir. Se marca como acción concreta en
`13_ROADMAP.md`: reescribir `OBSERVABILITY.md` desde el código real de
`observability.py`, no incrementalmente.

**Lo que sí sigue faltando genuinamente** (los otros 3 ítems de esa lista,
verificados hoy):

- **Métricas de negocio/sistema** (turnos publicados/cubiertos, tiempo a
  cubrir, latencia, tasa de error) — no hay ningún exportador de métricas
  (`grep` de `prometheus`/`statsd`/`opentelemetry` en `requirements.txt` sin
  resultados). `/admin/stats` existe pero es un panel manual, no una serie
  temporal.
- **Alertas** — ninguna configurada en código (esperable, las alertas viven
  en el dashboard de la plataforma de monitoreo, no en el repo). Ver
  hallazgo positivo §4 sobre UptimeRobot.
- **Trazas de WebSocket** — confirmado, `app/core/ws_manager.py` no expone
  ninguna métrica de conexiones activas/reconexiones.

## 2. `docs/DEPLOY.md` — una tabla vencida en un documento por lo demás actualizado

A diferencia de `OBSERVABILITY.md` (vencido en bloque), `DEPLOY.md` está
**mayormente al día** (tiene la sección completa de Neon con backups/
restore, el runbook de apagar el modo demo, y los pasos del dominio propio
— todo con fecha implícita posterior a la migración de Neon). Pero su
**tabla de variables de entorno** (`DEPLOY.md:29-39`) quedó de una versión
anterior: dice `DATABASE_URL | fromDatabase (staffya-db)`, que describe el
Postgres **gestionado por Render** de antes de la migración. El
`render.yaml` real (`01_INVENTORY.md §5`) dice explícitamente `sync: false`
con un comentario in-line: *"connection string de Neon, se setea manual en
el dashboard, nunca sobrescrita por este archivo"* — no hay ningún
`fromDatabase` en el `render.yaml` actual (no hay bloque `databases:` en
absoluto). Es un caso curioso de un documento que se actualizó **por
partes** (el cuerpo sí, la tabla de arriba no) — confirma que el patrón de
desfasaje no es "documento abandonado" sino "documento editado sin barrer
todas las menciones", el mismo síntoma que ya apareció 4 veces en esta
auditoría (`ARCHITECTURE.md`, `DATABASE.md`, `SCALABILITY_REPORT.md`,
`OBSERVABILITY.md`) para la misma migración a Neon.

## 3. GitHub Actions — sin hallazgos nuevos

Ya inventariado en `01_INVENTORY.md §4`: 3 jobs (`backend`/`frontend`/
`e2e`), obligatorios en PR y push a `main`, sin job de lint ni de auditoría
de dependencias. Es la pieza de infraestructura que **más mejoró** desde la
última auditoría integral (`docs/AUDIT_REPORT.md` de hace más de un mes
todavía registra *"CI: ausente"*, ver `02_ARCHITECTURE.md §1`) — hoy es un
gate real, no aspiracional.

## 4. Healthcheck — hallazgo positivo, incidente real ya resuelto

`backend/app/main.py:77` expone `/health` con `methods=["GET", "HEAD"]`,
con un comentario en el propio código explicando por qué: un monitor
externo (UptimeRobot, según el comentario y el título del commit
`b8a8f98`) reportaba el servicio como **caído** porque sólo `GET` estaba
declarado y el monitor sondeaba con `HEAD` (`405 Method Not Allowed`,
verificado en logs de Render según el comentario). Esto confirma dos cosas
que `OBSERVABILITY.md` no registra: **(a)** sí existe un monitor externo de
uptime en uso real (aunque no esté versionado en este repo, por naturaleza
— es config de UptimeRobot, no de código), y **(b)** ya causó y resolvió un
incidente real de falso positivo. Vale la pena que `OBSERVABILITY.md`
mencione la existencia de ese monitor externo (aunque sea una línea) para
que quien lea el documento no asuma "cero alertas" cuando en la práctica sí
hay una señal de disponibilidad externa corriendo.

## 5. Docker — sin cambios, hallazgos ya capturados

- `backend/Dockerfile`: imagen única (`python:3.11-slim`), sin multi-stage
  build — más pesada de lo necesario, no crítico a esta escala (ya
  señalado en `docs/AUDIT_REPORT.md §8`, sigue vigente, prioridad baja).
- `docker-compose.yml` declara `redis:7-alpine` y
  `postgis/postgis:16-3.4` sin uso real en el código — ya documentado con
  evidencia completa en `01_INVENTORY.md §7`, no se repite acá. Desde el
  ángulo de infraestructura: esto significa que **el entorno de desarrollo
  local no refleja fielmente producción** (dev corre con imagen PostGIS
  "por las dudas", producción corre contra Neon con Postgres liso) — no es
  grave (PostGIS es superset de Postgres, no rompe nada), pero es
  información falsa para cualquiera que lea `docker-compose.yml` para
  entender qué necesita la app.

## 6. Vercel — sin config-as-code, sin hallazgos nuevos

Confirmado en `01_INVENTORY.md §5`: no hay `vercel.json`. Headers de
seguridad/CSP del frontend viven en `next.config.ts` (que Vercel sí
respeta, no requiere `vercel.json` para eso) — no es una brecha real, sólo
significa que dominios/redirects/protecciones específicas de Vercel (si
existieran) vivirían sólo en el dashboard, sin versionar. Hoy no hay
evidencia de que se necesite nada de eso.

## 7. Backups y continuidad — bien documentado, sin hallazgos nuevos

`docs/DEPLOY.md §DB en Neon: backups y restore` cubre point-in-time
restore de Neon, `pg_dump` frío, y el procedimiento de verificación
post-cambio. Es una de las secciones más completas de toda la
documentación de infra — no se encontró nada que corregir. Pendiente
real, ya capturado en `CLAUDE.md` ("Pendiente de la operadora" ítem 3): el
**ensayo real** de restore no se hizo todavía (existe el procedimiento
escrito, no la verificación práctica) — es trabajo operativo de Julieta,
no de código.

## 8. Cloudinary — remite a `03_SECURITY.md §11`

No se repite acá: el hallazgo de infraestructura (preset *unsigned*, sin
validación server-side, límites configurados fuera del repo) ya se
documentó desde el ángulo de seguridad en la fase anterior.

## 9. Veredicto de esta fase

La infraestructura real (Render + Vercel + Neon + CI) es más sólida y está
más al día que su propia documentación. `docs/DEPLOY.md` es, en su
mayoría, un documento vivo y confiable, con una sola tabla vencida.
`docs/OBSERVABILITY.md` es el caso más grave de toda la auditoría de
documentación desactualizada: describe como inexistente una capa de
observabilidad (logging estructurado + Sentry) que **ya está en
producción**. Ninguno de los hallazgos de esta fase es un riesgo de
infraestructura nuevo — todos son de **documentación no reflejando la
realidad**, que es exactamente el patrón transversal que esta auditoría
viene detectando fase tras fase desde `02_ARCHITECTURE.md`.
