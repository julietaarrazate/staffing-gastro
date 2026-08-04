# 08 — Backend

> Fase 8 de la auditoría OÍDO. Cubre: FastAPI, rutas, errores, OpenAPI,
> logging, servicios, dependencias, validaciones, excepciones, background
> tasks. Buena parte de este territorio ya se cubrió en fases anteriores
> (arquitectura de capas en `02_ARCHITECTURE.md`, seguridad/validaciones en
> `03_SECURITY.md`, performance/transacciones en `04_PERFORMANCE.md`,
> observabilidad/logging en `06_INFRASTRUCTURE.md`) — esta fase no repite
> esos hallazgos, sólo referencia. Se enfoca en lo que no tenía fase propia
> todavía: OpenAPI expuesto, background tasks (scheduler), y verificación
> puntual de conteos ya usados en fases anteriores. Sin cambios de código.

## 1. Rutas — consistentes, sin hallazgos nuevos

`backend/app/main.py:91-103` registra **13 routers**, todos bajo el mismo
prefijo `/api/v1` (incluye `matching_search_router` y `push_router` como
routers separados dentro de sus módulos, además de los 11 routers "uno por
módulo" esperables). Confirma lo que ya decía `docs/AUDIT_REPORT.md §5`:
versionado 100% consistente, sin rutas sueltas fuera de `/api/v1`.

## 2. OpenAPI — expuesto sin gate, hallazgo nuevo de esta fase

`backend/app/main.py:50-55`: `FastAPI(title=..., description=..., version=
"0.1.0", lifespan=lifespan)` — **sin `docs_url=None`/`redoc_url=None`
condicionado a producción**. Esto significa que `/docs` (Swagger UI) y
`/redoc` quedan **públicamente accesibles en producción**
(`staffya-backend.onrender.com/docs`), exponiendo el mapa completo de
rutas, schemas Pydantic y modelos de request/response de toda la API.

- **Severidad:** 🟢 Baja — no es una vulnerabilidad (no expone datos, sólo
  la *forma* de la API, que de todos modos es descubrible leyendo el
  código si el repo es visible); es una práctica común en productos en
  etapa beta. Se documenta porque **no está mencionado en ningún lugar**
  de `docs/SECURITY.md`/`03_SECURITY.md` como decisión consciente — hoy es
  simplemente el comportamiento por defecto de FastAPI, no una elección
  explícita. Vale la pena que quede como decisión documentada (dejarlo
  abierto es razonable para una beta, y conviene decidir explícitamente
  antes de un lanzamiento comercial más amplio) en vez de comportamiento
  por omisión.
- **`version="0.1.0"` hardcodeado**, igual que `pyproject.toml:3` — nunca
  se incrementó pese a las ~20 migraciones y features nuevas desde el
  primer commit. No es un problema funcional (no hay clientes externos que
  dependan de negociar versión de API todavía), pero si en algún momento
  se expone la API a integraciones de terceros, este campo dejará de ser
  cosmético.

## 3. Background tasks — scheduler in-process, bien diseñado, con un riesgo compartido ya conocido

`backend/app/modules/shift/application/scheduler.py` implementa **dos
chequeos periódicos en un solo loop** (`asyncio`, cada 5 minutos, arrancado
desde el `lifespan` de FastAPI en `main.py`):

1. **Asistencia (ADR-0008):** recordatorio push de check-in + no-show
   automático tras el período de gracia.
2. **Escalada de urgencia (ADR-0009):** turnos abiertos que no se cubren
   rápido se marcan `urgent` y notifican a un círculo más amplio de
   candidatos.

**Diseño correcto para la escala actual:** in-process, sin Celery/cron
externo, gateado a `settings.is_production` (no corre en tests, evita que
el único test que dispara el `lifespan` quede esperando un loop infinito).
Coherente con `docs/PRINCIPLES.md` #10 (no introducir infraestructura sin
necesidad real). El propio archivo documenta esta decisión en su docstring
de módulo — buena práctica de "por qué no X" explícito.

**Riesgo, no nuevo pero no estaba nombrado para este componente
específico:** el scheduler asume **una sola instancia del proceso**
corriendo. Es exactamente la misma asunción que ya está documentada para
el rate limiting (`app/core/rate_limit.py`, en memoria por proceso) y para
`ws_manager.py` (conexiones WebSocket en memoria) — `docs/SECURITY.md` y
`docs/SCALABILITY_REPORT.md` ya identifican ese techo para esos dos
componentes, pero **ninguno de los dos documentos menciona el
scheduler** como un tercer componente con la misma limitación. Si el plan
de Render pasara a 2+ instancias (horizontal) sin cambiar nada acá, **el
chequeo de asistencia y la escalada de urgencia se ejecutarían por
duplicado** — no hay lock distribuido ni bandera de "sólo la instancia
líder corre el scheduler". El impacto de duplicar un `run_attendance_check`
es bajo (las operaciones son idempotentes por diseño de dominio: un
no-show ya marcado no se puede volver a marcar, ver máquina de estados de
`Shift`), pero sí podría duplicar notificaciones push/en-app (un usuario
recibiendo el mismo recordatorio 2 veces). Se agrega a `13_ROADMAP.md`
como nota para cuando se evalúe escalar horizontalmente — no antes,
consistente con "no arreglar lo que no está roto a la escala actual".

## 4. Validaciones, excepciones, logging — remite a fases anteriores

- Validaciones Pydantic (password, geolocalización, montos con `Decimal`):
  ver `03_SECURITY.md §9, §11`.
- Mapeo de excepciones de dominio → HTTP (patrón repetido
  `_bad_request`/`_not_found` por módulo, sin handler central salvo
  `IdempotencyReplay`): ver `02_ARCHITECTURE.md §6`.
- Logging y observabilidad (`request_id`, JSON estructurado, Sentry —
  existente pero sin eventos de seguridad instrumentados): ver
  `03_SECURITY.md §10` y `06_INFRASTRUCTURE.md §1`.
- Transacciones (commit por repositorio, no por caso de uso): ver
  `04_PERFORMANCE.md §1` / `05_DATABASE.md §5`.

## 5. Tests — conteo verificado, ya corregido en `01_INVENTORY.md`

No se repite acá el detalle: **255 tests** reales (`pytest
--collect-only -q`), no los "~218" que cita `CLAUDE.md` — ya corregido y
documentado con el comando exacto en `01_INVENTORY.md §3`.

## 6. Veredicto de esta fase

No se encontraron hallazgos de severidad alta nuevos en esta fase — la
mayor parte del territorio de "backend" ya había sido cubierto,
correctamente, por fases anteriores de esta misma auditoría. Los dos
hallazgos genuinamente nuevos son de severidad baja (OpenAPI sin gate,
versión de API sin incrementar) y uno de severidad media-baja pero real
(el scheduler comparte la misma asunción de instancia única que ya
limita al rate limiting y a los WebSockets, sin estar nombrado
explícitamente junto a ellos en la documentación de escalabilidad). El
backend, en conjunto, se sostiene con el mismo nivel de disciplina que ya
confirmaron `02_ARCHITECTURE.md` y `03_SECURITY.md`.
