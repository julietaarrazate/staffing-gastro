"""add meal to shifts ("perso"/comida de personal)

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-06

Igual que `tips`: beneficio del turno que atrae al trabajador (comida de
personal, común en jornadas full-time). `server_default='false'` para que las
filas existentes queden en False sin reescritura manual.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column(
            "meal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("shifts", "meal")
