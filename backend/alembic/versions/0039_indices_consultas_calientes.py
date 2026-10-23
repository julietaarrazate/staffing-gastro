"""índices para las consultas calientes + fuera los duplicados

Agrega índices con la forma exacta de las consultas que más corren (medición
del 2026-10-22, `docs/historial/2026-10-23-indices-y-retencion.md`):

- `notifications (user_id, created_at DESC)`: la bandeja (`list_by_user`).
- `shifts (status, start_at)`: feed y pasadas del scheduler.
- `shifts (company_id, created_at DESC)`: panel del comercio (`list_by_company`).
- `shifts (position, lower(city), created_at)`: referencia de pago
  (`hourly_pay_samples`) y filtro por ciudad del feed; `ix_shifts_city` es
  sobre `city` sin `lower()` y el planner no lo puede usar.
- `chat_messages (shift_id, created_at)`: mensajes de un chat y último
  mensaje por chat.

Saca los que estaban duplicados (cuestan en cada escritura y no suman nada):

- `ix_notifications_user_id`: es prefijo de `ix_notifications_user_id_read`
  (0022) y del nuevo `(user_id, created_at)`.
- `company_profiles_user_id_key` y `worker_profiles_user_id_key`: el
  `UniqueConstraint("user_id")` de 0002, que convivía con el índice único
  `ix_*_user_id` de la misma migración sobre la misma columna. Queda el
  índice único, que es lo que declara el modelo (`unique=True, index=True`).

Tablas chicas (la más grande, `notifications`, tiene cientos de filas): no
hace falta `CONCURRENTLY`.

Revision ID: 0039
Revises: 0038
Create Date: 2026-10-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DUPLICATE_UNIQUE_CONSTRAINTS = (
    ("company_profiles", "company_profiles_user_id_key"),
    ("worker_profiles", "worker_profiles_user_id_key"),
)


def upgrade() -> None:
    op.create_index(
        "ix_notifications_user_id_created_at",
        "notifications",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index("ix_shifts_status_start_at", "shifts", ["status", "start_at"])
    op.create_index(
        "ix_shifts_company_id_created_at",
        "shifts",
        ["company_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_shifts_position_lower_city_created_at",
        "shifts",
        ["position", sa.text("lower(city)"), "created_at"],
    )
    op.create_index(
        "ix_chat_messages_shift_id_created_at",
        "chat_messages",
        ["shift_id", "created_at"],
    )

    op.drop_index("ix_notifications_user_id", table_name="notifications")
    if op.get_bind().dialect.name == "postgresql":
        # La unicidad la sigue garantizando el índice único `ix_*_user_id`.
        for table, constraint in _DUPLICATE_UNIQUE_CONSTRAINTS:
            op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        for table, constraint in _DUPLICATE_UNIQUE_CONSTRAINTS:
            op.create_unique_constraint(constraint, table, ["user_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    op.drop_index("ix_chat_messages_shift_id_created_at", table_name="chat_messages")
    op.drop_index("ix_shifts_position_lower_city_created_at", table_name="shifts")
    op.drop_index("ix_shifts_company_id_created_at", table_name="shifts")
    op.drop_index("ix_shifts_status_start_at", table_name="shifts")
    op.drop_index("ix_notifications_user_id_created_at", table_name="notifications")
