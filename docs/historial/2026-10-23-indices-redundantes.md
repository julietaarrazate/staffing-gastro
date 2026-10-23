# Fuera los índices que quedaron de más después de la 0040

**Pedido:** Julieta aprobó cerrar lo que quedó abierto en
[`2026-10-23-indices-y-retencion.md`](./2026-10-23-indices-y-retencion.md):
sacar los índices simples que pasaron a ser prefijo de los compuestos de la
0040 y los booleanos que casi no sirven, si se confirma que ninguna consulta
los necesita.

**Qué cambió:** nada visible. Cada alta de turno, aviso o mensaje escribe
menos índices.

- Migración `backend/alembic/versions/0041_quitar_indices_redundantes.py`
  (revisa la 0040). Saca:
  - `ix_shifts_company_id`: prefijo de `(company_id, created_at DESC)`;
  - `ix_shifts_status`: prefijo de `(status, start_at)`;
  - `ix_chat_messages_shift_id`: prefijo de `(shift_id, created_at)`;
  - `ix_notifications_read`: ninguna consulta lo usa.

  En los tres primeros se verificó en la 0040 que la primera columna del
  compuesto es la del simple. También cubre las claves foráneas con
  `ON DELETE CASCADE` (`shifts.company_id`, `chat_messages.shift_id`). El
  `downgrade` los vuelve a crear igual que 0003, 0005 y 0007.
- **`ix_chat_messages_read` se queda.** Las tres consultas que filtran por
  `read` en el chat (`count_unread`, `unread_counts_by_shift`, `mark_read`,
  en `chat/infrastructure/repositories.py`) también filtran por `shift_id`,
  así que el compuesto las cubre. Pero casi todos los mensajes terminan
  leídos, entonces `read = false` es muy selectivo y el planner prefiere el
  booleano. Sin él, contar los no leídos de la bandeja de chats tardó más
  (tabla de abajo).
- En notificaciones, la única consulta con `read` es la retención
  (`delete_read_before`: `read AND created_at < ?`, una vez por día). Toca la
  mayoría de las filas y el planner recorre la tabla con o sin el índice. La
  bandeja filtra por `user_id`, que cubren `(user_id, read)` y
  `(user_id, created_at DESC)`.
- Los modelos (`shift/`, `chat/` y `notification/infrastructure/models.py`)
  dejan de declarar `index=True` en esas columnas. Se comprobó que
  `create_all`, que es lo que usan los tests, crea en Postgres exactamente
  los mismos índices, con la misma definición, que `alembic upgrade head` en
  las tres tablas.

**Medición (antes → después).** Postgres 16 local descartable (no Neon),
migrado con Alembic hasta 0040, con los mismos datos sintéticos de la 0040:
20.000 turnos, 105.000 avisos (un usuario con 5.000) y 70.000 mensajes (20
chats de 1.000), casi todos leídos salvo los de las últimas 2 horas.
`VACUUM ANALYZE` antes de cada lado; mejor de 5 corridas.

| Consulta | Índice antes | Índice después | ms antes → después |
|---|---|---|---|
| Bandeja de avisos (`user_id`, `ORDER BY created_at DESC LIMIT 50`) | `(user_id, created_at)` | igual | 0,15 → 0,15 |
| Feed (`status IN … AND start_at > now()`) | `(status, start_at)` | igual | 1,20 → 1,06 |
| Scheduler (`status IN (3 estados)`) | `(status, start_at)` | igual | 0,36 → 0,31 |
| Conteo por un estado | `(status, start_at)` index-only | igual | 0,10 → 0,10 |
| Panel del comercio (`company_id ORDER BY created_at DESC`) | `(company_id, created_at)` | igual | 0,20 → 0,20 |
| Turnos de un comercio sin orden (cascada) | `(company_id, created_at)` | igual | 0,11 → 0,10 |
| Mensajes de un chat | `(shift_id, created_at)` | igual | 0,09 → 0,09 |
| Último mensaje de 20 chats (ROW_NUMBER) | `ix_chat_messages_shift_id` | `(shift_id, created_at)` | 15,9 → 15,6 |
| No leídos de un chat / de 20 chats / marcar leídos | `ix_chat_messages_read` | igual (se queda) | 0,15 / 0,13 / 0,29 → 0,15 / 0,12 / 0,28 |
| Retención de avisos leídos (DELETE) | recorre la tabla | igual | 35 → 38 (ruido) |

Con los índices de antes, el planner ya elegía el compuesto para casi todo:
los simples no se usaban. Ningún plan perdió su índice.

Escrituras, mejor de 5 (inserts en lote dentro de una transacción
descartada): 10.000 turnos **256 → 225 ms** (−12 %), 20.000 avisos
**284 → 274 ms** (−4 %), 20.000 mensajes **419 → 378 ms** (−10 %). Índices
de las tres tablas: 20 → 16, de 24 a 22 MB con estos datos.

Por qué se quedó `ix_chat_messages_read`: en una primera corrida también se
sacó y el planner pasó a `(shift_id, created_at)` filtrando fila por fila:

| Consulta | con el booleano → sin él |
|---|---|
| No leídos de 20 chats de 1.000 mensajes (bandeja de chats) | 0,10 → 2,45 ms |
| No leídos de 20 chats de ~25 mensajes | 0,12 → 0,39 ms |
| No leídos de un chat de 1.000 | 0,12 → 0,41 ms |
| Marcar leídos un chat de 1.000 | 0,28 → 0,50 ms |

Migración probada ida, vuelta e ida en el mismo Postgres: el `downgrade`
deja `pg_indexes` idéntico a 0040 (nombre y definición) y la segunda subida,
idéntica a la primera. `alembic heads`: una sola, `0041`. Las sentencias SQL
por request no cambian: se sacan índices, no consultas.

**Por qué así:** un índice que es prefijo de otro sólo cuesta en cada
escritura. Para los booleanos no alcanzaba con que un compuesto "cubra" la
consulta: se miró qué elegía el planner con datos parecidos a los reales.
Se descartó cambiar `ix_chat_messages_read` por un índice parcial
`(shift_id) WHERE read IS false`: sería más chico, pero es un índice nuevo y
no hace falta con las tablas de hoy.

**Queda abierto:** nada nuevo. Si la bandeja de chats crece mucho, el
parcial de arriba es el siguiente paso.
