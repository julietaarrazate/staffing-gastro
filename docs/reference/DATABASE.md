# DATABASE.md — Persistencia y migraciones (arquitectura técnica)

> Cómo se guardan los datos. Motor async + Alembic. La forma del negocio vive en
> [DOMAIN.md](../foundation/DOMAIN.md); acá el detalle de infraestructura.

## Motor

- **PostgreSQL** en producción; **SQLite en memoria** en tests.
- **SQLAlchemy 2.0 async** con driver **asyncpg** (`app/core/database.py`):
  `engine` con `pool_pre_ping=True`, `AsyncSessionLocal`
  (`expire_on_commit=False`, `autoflush=False`) y la dependencia `get_session`
  que entrega **una sesión por request** y hace rollback ante excepción.
- El `DATABASE_URL` se normaliza a `postgresql+asyncpg://` en `config.py`
  (Render entrega `postgresql://`, driver psycopg2 por defecto).

## Modelos (ORM)

Cada módulo define sus modelos en `infrastructure/models.py`, heredando de la
`Base` declarativa compartida. Los modelos son **adaptadores**: no llevan lógica
de dominio (esa vive en `domain/entities.py`), sólo mapean tablas ↔ filas.

Para que las tablas existan en los tests, **todo modelo nuevo se importa en
`tests/conftest.py`** antes de `Base.metadata.create_all` (ver
[TESTING.md](./TESTING.md)). Omitirlo = tabla ausente en SQLite.

## Migraciones (Alembic)

Historial en `backend/alembic/versions/` (lineal, una cabeza):

| Revisión | Tabla / cambio |
|----------|----------------|
| `0001` | `users` |
| `0002` | perfiles (`worker_profiles`, `company_profiles`) |
| `0003` | `shifts` |
| `0004` | asignación de trabajador al turno |
| `0005` | `notifications` |
| `0006` | campos de asistencia del turno (check-in/out geolocalizado) |
| `0007` | `chat_messages` |
| `0008` | `reviews` |
| `0009` | `shift_applications` (postulaciones) |
| `0010` | `refresh_sessions` (sesiones de refresh token revocables, ADR-0002) |
| `0011` | `subscriptions` (mensualidad al comercio, ADR-0005) |
| `0012` | `password_reset_tokens` (recuperación de contraseña) |
| `0013` | `push_subscriptions` (Web Push / VAPID) |
| `0014` | no-show + cancelación tardía, columnas (ADR-0007) |
| `0015` | `idempotency_keys` (idempotencia en mutaciones críticas) |
| `0016` | `notification_link` (deep-link de notificación a pantalla) |
| `0017` | agrupación de turnos por evento (`event_id`/`event_name`) |
| `0018` | `company_profiles.payments_recorded` (reputación real del comercio) |
| `0019` | `shifts.checkin_reminder_sent_at` (scheduler de recordatorio) |
| `0020` | métrica de cobertura del turno (panel admin) |
| `0021` | `shifts.escalated_at` (escalada automática de urgencia, ADR-0009) |

**Regla:** toda tabla o columna nueva entra por una migración Alembic; nunca se
crea el esquema a mano en producción. En Render, el arranque corre
`alembic upgrade head` antes de levantar la app (ver [DEPLOY.md](./DEPLOY.md)).

## Relaciones clave (a nivel datos)

- `users` 1—1 `worker_profiles` / `company_profiles` (según rol).
- `shifts` N—1 `company_profiles` (dueño) y 0/1 `worker_profiles` (asignado).
- `shift_applications` N—1 `shifts` y N—1 `worker_profiles`.
- `chat_messages`, `reviews`, `notifications` cuelgan del turno/usuario.
- `refresh_sessions` N—1 `users` (una fila por refresh token emitido).

## Inconsistencias / pendientes

> - **`quantity` vs asignación única — decisión permanente, no pendiente.** El
>   turno tiene `quantity`, pero el modelo guarda **un solo** `worker_profile_id`
>   asignado. La API capa `quantity` a `1` en la creación/edición (`le=1` en el
>   schema, R1.4). [ADR-0003](../adr/ADR-0003-quantity-single-assignment.md)
>   decide que **un turno = una persona, para siempre** — no se va a construir
>   multi-asignación (tabla N—N de asignaciones). El campo `quantity` queda en
>   el modelo hasta la próxima migración que toque `shifts` por otro motivo
>   (no amerita una migración dedicada sólo para eso, según el propio ADR).
> - **PostGIS no está en uso.** Las coordenadas se guardan como columnas simples
>   y la distancia se calcula en Python (Haversine, `app/core/geo.py`), no en la
>   DB. PostGIS está **previsto**, no adoptado (sería un ADR).
> - **DB en Neon** (serverless, `aws-us-east-2`) — reemplazó al Postgres
>   gestionado de Render (expiraba a los 90 días). Migración verificada en vivo
>   el 2026-07-23, ver
>   [INCIDENTE_2026-07-23_BACKEND_CAIDO.md](../INCIDENTE_2026-07-23_BACKEND_CAIDO.md).
> - **Índices:** las migraciones ya crean índices en las FKs y columnas de
>   filtro frecuente (`shifts.company_id/position/status/worker`, perfiles,
>   `notifications`, `reviews`, `shift_applications`). Revisar cobertura para
>   consultas nuevas al escalar (detalle en
>   [PERFORMANCE_REPORT.md](../audits/PERFORMANCE_REPORT.md)).
