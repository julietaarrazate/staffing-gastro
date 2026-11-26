"""turnos: puntualidad real (ADR-0008, actualización 2026-11-26)

- `checkin_reminder_step`: cuántos de los tres recordatorios de llegada ya
  salieron (10 minutos antes, a la hora y 5 minutos después).
- `arrival_marked_by_company_at` y `arrival_on_time`: la llegada la marcó el
  comercio («Ya llegó») porque la persona no la marcó, y qué dijo: a horario
  o tarde.

Revision ID: 0064
Revises: 0063 (reconfirmación antes del turno)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0064"
down_revision: str | None = "0063"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("checkin_reminder_step", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "shifts",
        sa.Column("arrival_marked_by_company_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("shifts", sa.Column("arrival_on_time", sa.Boolean(), nullable=True))
    # Un turno al que ya se le mandó el recordatorio viejo (20 minutos después
    # del inicio) no tiene que recibir ahora los tres nuevos.
    op.execute(
        "UPDATE shifts SET checkin_reminder_step = 3 WHERE checkin_reminder_sent_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("shifts", "arrival_on_time")
    op.drop_column("shifts", "arrival_marked_by_company_at")
    op.drop_column("shifts", "checkin_reminder_step")
