"""add link column to notifications (destino concreto del aviso)

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-28

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable: las notificaciones ya existentes se quedan sin enlace y caen
    # al destino genérico por tipo (`deep_link_for`).
    op.add_column("notifications", sa.Column("link", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "link")
