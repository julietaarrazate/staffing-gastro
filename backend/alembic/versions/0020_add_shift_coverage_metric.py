"""add published_at/first_assigned_at to shifts (métrica: tiempo real de cobertura)

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-02

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Sin backfill: mide desde acá en adelante (turnos ya publicados antes de
    # esta migración simplemente no entran en la métrica del panel admin).
    op.add_column(
        "shifts",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "shifts",
        sa.Column("first_assigned_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "first_assigned_at")
    op.drop_column("shifts", "published_at")
