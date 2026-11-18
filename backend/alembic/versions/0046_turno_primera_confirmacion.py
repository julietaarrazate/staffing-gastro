"""shifts.first_confirmed_at: cuándo confirmó la persona por primera vez

Revision ID: 0046
Revises: 0045
Create Date: 2026-11-17

Medición de la beta (docs/planning/BETA_TABLERO.md, M3): «cubierto» pasa a
ser «la persona confirmó», no «el comercio eligió». `Shift.confirm()` guarda
la hora la primera vez (no se pisa si el turno se reabre y confirma otra
persona).

Sin backfill: los turnos confirmados antes de esta migración quedan sin la
hora y no entran en las métricas de cobertura. Inventarla desde `updated_at`
mezclaría datos falsos con la medición.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0046"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("first_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "first_confirmed_at")
