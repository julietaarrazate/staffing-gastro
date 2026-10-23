# Índices para las consultas calientes, fuera los duplicados y retención de sesiones y avisos (#PR)

**Pedido:** Julieta aprobó el plan de rendimiento del backend (medición del
2026-10-22): índices con la forma real de las consultas que más corren,
sacar índices duplicados y dejar de acumular sesiones de refresh vencidas
(403 de 499 en producción) y avisos viejos (un usuario ya tenía 167).

**Qué cambió:** nada visible para quien usa la app; la base trabaja menos.

- Migración `backend/alembic/versions/0039_indices_consultas_calientes.py`:
  - agrega `notifications (user_id, created_at DESC)` (bandeja),
    `shifts (status, start_at)` (feed y scheduler),
    `shifts (company_id, created_at DESC)` (panel del comercio),
    `shifts (position, lower(city), created_at)` (referencia de pago
    `hourly_pay_samples`, que filtra por `lower(city)`; `ix_shifts_city` es
    sobre `city` a secas y no servía) y `chat_messages (shift_id, created_at)`;
  - saca `ix_notifications_user_id` (prefijo de `(user_id, read)` y del nuevo)
    y los `UNIQUE` repetidos `company_profiles_user_id_key` /
    `worker_profiles_user_id_key` (0002 creaba la constraint **y** un índice
    único sobre la misma columna; queda el índice, que es lo que declara el
    modelo).
- Los modelos declaran los mismos índices (`Index(...)` al final de
  `notification/`, `shift/` y `chat/infrastructure/models.py`), así que
  `create_all` de los tests crea lo mismo que la migración.
- Retención en el scheduler (`run_retention_cleanup`,
  `backend/app/modules/shift/application/scheduler.py`), con puertos nuevos
  `RefreshSessionRepository.delete_expired_before` y
  `NotificationRepository.delete_read_before`:
  - sesiones de refresh vencidas hace **más de 7 días**; las revocadas todavía
    vigentes se quedan (son las que detectan el reuso de un token, ADR-0002);
  - notificaciones **leídas** de **más de 90 días**; una no leída no se borra
    nunca;
  - como mucho una vez cada 24 h y sin despertar la base por su cuenta: va
    colgada de las pasadas que el loop ya hace (al menos cada 6 h).
- Tests: `backend/tests/test_retencion.py`.

**Medición (antes → después).** EXPLAIN ANALYZE en un Postgres 16 local
descartable (no Neon), migrado con Alembic hasta 0038 y después a 0039, con
datos sintéticos: 20.000 turnos de 200 comercios, 105.000 avisos (uno de los
usuarios con 5.000) y 70.000 mensajes (20 chats de 1.000). Mejor de 3 corridas.

| Consulta | Plan en 0038 | Plan en 0039 | Tiempo |
|---|---|---|---|
| Bandeja: avisos de un usuario, `ORDER BY created_at DESC LIMIT 50` | Bitmap sobre `ix_notifications_user_id` (5.050 filas) + top-N sort | Index Scan sobre `(user_id, created_at DESC)`, sin sort, lee 50 | 1,39 → 0,09 ms |
| Panel del comercio, `ORDER BY created_at DESC LIMIT 50` | Bitmap + sort | Index Scan, sin sort | 0,35 → 0,19 ms |
| Referencia de pago, `position = ? AND lower(city) = ?` | Bitmap sobre `ix_shifts_position` (6.667 filas) + recheck | Bitmap sobre el índice de expresión (84 filas) | 2,61 → 0,16 ms |
| Mensajes de un chat, `ORDER BY created_at LIMIT 100` | Bitmap (1.000 filas) + sort | Index Scan, sin sort | 0,86 → 0,08 ms |
| Feed: abiertos con `start_at > now()` | Bitmap sobre `ix_shifts_status` (1.000) + sort | Bitmap sobre `(status, start_at)` (950) + sort | 1,17 → 1,07 ms |
| Último mensaje de 20 chats (ROW_NUMBER) | Bitmap + sort de 20.000 | igual (el planner no usa el índice nuevo para la ventana) | 17,6 → 12,1 ms |

En SQLite (tests) un EXPLAIN no dice nada de Postgres, por eso se midió en un
Postgres local. Sentencias por request en el bench de consultas
(`perf/bench_queries.py`, N=2 y N=20): **idénticas** antes y después en los 39
endpoints (los índices no cambian cuántas consultas se hacen, sino cuánto
cuesta cada una). La migración se probó ida, vuelta e ida en el mismo
Postgres: `downgrade` deja exactamente los índices de 0038.

**Por qué así:** índices compuestos con la forma de cada consulta en vez de
más índices simples, que es lo que había y el planner no podía combinar con
el `ORDER BY`. La retención va en el scheduler que ya existe (sin
infraestructura nueva) y con reglas conservadoras; se descartó borrar las
sesiones revocadas vigentes y los avisos no leídos.

**Queda abierto:**
- `ix_shifts_company_id`, `ix_shifts_status` e `ix_chat_messages_shift_id`
  quedan como prefijos de los compuestos nuevos: son redundantes, pero no
  estaban en la lista de duplicados y se dejan para una decisión aparte.
- `ix_notifications_read` e `ix_chat_messages_read` (booleanos, casi sin
  selectividad) no son duplicados: siguen, aunque probablemente no se usen.
- Hoy las tablas son chicas (8 turnos en producción): el beneficio se nota
  cuando crecen.
