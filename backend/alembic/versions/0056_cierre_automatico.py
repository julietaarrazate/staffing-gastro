"""turnos: recordatorio y cierre automático del turno sin cerrar (decisión 24)

- `shifts.finish_reminder_sent_at`, nullable: cuándo se le recordó al comercio
  que cierre un turno con la salida marcada (a las 24 h de `check_out_at`).
  Marca de sistema para no mandar el recordatorio dos veces.
- `shifts.auto_finished_at`, nullable: cuándo lo cerró Oído solo (a las 72 h
  de `check_out_at`). `NULL` si lo cerró el comercio.
- Sin backfill: los turnos ya en `check_out` los toma el scheduler en su
  primera pasada.

Revision ID: 0056
Revises: 0055 (no cubierto con la cuenta del comercio suspendida, decisión 22)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0056"
down_revision: str | None = "0055"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("finish_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "shifts",
        sa.Column("auto_finished_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "auto_finished_at")
    op.drop_column("shifts", "finish_reminder_sent_at")
