# DATABASE.md — Persistencia y migraciones (arquitectura técnica)

> Cómo se guardan los datos. Motor async + Alembic. La forma del negocio vive en
> [DOMAIN.md](./DOMAIN.md); acá el detalle de infraestructura.

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

> - **`quantity` vs asignación única.** El turno tiene `quantity`, pero el modelo
>   guarda **un solo** `worker_profile_id` asignado. **Mitigado en R1.4:** la API
>   capa `quantity` a `1` en la creación/edición (`le=1` en el schema), así que
>   ya no se puede publicar un turno que prometa más cupos de los que el modelo
>   puede cubrir. Cubrir varios cupos por turno de verdad requeriría una tabla
>   de asignaciones N—N (multi-asignación, decisión de producto pendiente — ver
>   [SHIFT.md](./SHIFT.md)).
> - **PostGIS no está en uso.** Las coordenadas se guardan como columnas simples
>   y la distancia se calcula en Python (Haversine, `app/core/geo.py`), no en la
>   DB. PostGIS está **previsto**, no adoptado (sería un ADR).
> - **DB de Render (free) expira a los 90 días.** Migración a **Neon** prevista;
>   pasos en `backend/README.md`. Ver [TECH_DEBT.md](./TECH_DEBT.md).
> - **Índices:** las migraciones ya crean índices en las FKs y columnas de
>   filtro frecuente (`shifts.company_id/position/status/worker`, perfiles,
>   `notifications`, `reviews`, `shift_applications`). Revisar cobertura para
>   consultas nuevas al escalar (detalle en
>   [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md)).
