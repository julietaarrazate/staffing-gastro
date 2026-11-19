"""turnos: índices parciales para las ausencias (ficha del admin y «Ausencias de hoy»)

Medido con 20.000 turnos en Postgres local (`EXPLAIN ANALYZE`), las dos
consultas recorrían `shifts` entero (~2,7 ms, creciendo con el total):

- `list_history_by_worker`: `worker_profile_id = ? OR
  last_no_show_worker_profile_id = ?`. La segunda columna no tenía índice, así
  que el `OR` no podía usar ni el de `worker_profile_id`. Y el
  `ON DELETE SET NULL` de esa FK también recorría la tabla al borrar un perfil.
- `list_no_shows`: rango sobre `no_show_at`.

Los dos índices son parciales (`... IS NOT NULL`): sólo indexan los turnos con
ausencia, una fracción mínima, así que no encarecen las escrituras comunes.
Tabla chica hoy: no hace falta `CONCURRENTLY`.

Revision ID: 0059
Revises: 0058 (cierre de turno por la admin)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0059"
down_revision: str | None = "0058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_shifts_last_no_show_worker_profile_id",
        "shifts",
        ["last_no_show_worker_profile_id"],
        postgresql_where=sa.text("last_no_show_worker_profile_id IS NOT NULL"),
    )
    op.create_index(
        "ix_shifts_no_show_at",
        "shifts",
        ["no_show_at"],
        postgresql_where=sa.text("no_show_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_shifts_no_show_at", table_name="shifts")
    op.drop_index("ix_shifts_last_no_show_worker_profile_id", table_name="shifts")
