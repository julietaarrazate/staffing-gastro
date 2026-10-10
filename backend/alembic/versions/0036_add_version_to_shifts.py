"""add version to shifts (bloqueo optimista)

Cada UPDATE del turno queda condicionado a la versión que se leyó y la
incrementa (ADR-0016). Sin esto, dos acciones simultáneas sobre el mismo
turno (el comercio cancela mientras el trabajador confirma) se pisaban y
ganaba la última en escribir. Las filas existentes arrancan en 1.

Revision ID: 0036
Revises: 0035
Create Date: 2026-10-10

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0036"
down_revision: str | None = "0035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("shifts", "version")
