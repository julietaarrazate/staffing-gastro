"""fuera los índices redundantes que dejó la 0040

Lo que quedó abierto en `docs/historial/2026-10-23-indices-y-retencion.md`
(detalle y EXPLAIN en `docs/historial/2026-10-23-indices-redundantes.md`).

Prefijos de un compuesto de la 0040 (la primera columna del compuesto es la
misma, así que toda consulta que usaba el simple puede usar el compuesto, y
las claves foráneas con `ON DELETE CASCADE` también):

- `ix_shifts_company_id` (0003) → `ix_shifts_company_id_created_at`
  `(company_id, created_at DESC)`.
- `ix_shifts_status` (0003) → `ix_shifts_status_start_at` `(status, start_at)`.
- `ix_chat_messages_shift_id` (0007) → `ix_chat_messages_shift_id_created_at`
  `(shift_id, created_at)`.

Booleano de un solo campo:

- `ix_notifications_read` (0005): ninguna consulta lo usa. La bandeja filtra
  por `user_id` (compuestos de 0022 y 0040) y la retención
  (`delete_read_before`: `read AND created_at < ?`, una vez por día) toca la
  mayoría de las filas, así que el planner recorre la tabla aunque el índice
  exista.

`ix_chat_messages_read` se queda: casi todos los mensajes terminan leídos, así
que `read = false` sí es selectivo y el planner lo prefiere para contar y
marcar los no leídos (`count_unread`, `unread_counts_by_shift`, `mark_read`).
Sin él esas consultas usan `(shift_id, created_at)` y cuestan más (medido en
el historial).

Tablas chicas (la más grande, `notifications`, tiene cientos de filas): no
hace falta `CONCURRENTLY`. El `downgrade` los vuelve a crear con la misma
definición que les dieron 0003, 0005 y 0007.

Revision ID: 0041
Revises: 0040
Create Date: 2026-10-23

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0041"
down_revision: str | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (índice, tabla, columnas) tal como los crearon 0003, 0005 y 0007.
_INDICES = (
    ("ix_shifts_company_id", "shifts", ["company_id"]),
    ("ix_shifts_status", "shifts", ["status"]),
    ("ix_chat_messages_shift_id", "chat_messages", ["shift_id"]),
    ("ix_notifications_read", "notifications", ["read"]),
)


def upgrade() -> None:
    for name, table, _columns in _INDICES:
        op.drop_index(name, table_name=table)


def downgrade() -> None:
    for name, table, columns in reversed(_INDICES):
        op.create_index(name, table, columns)
