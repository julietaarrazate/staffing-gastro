"""add departure_reminder_sent_at to shifts ("va en camino")

Cuándo se le recordó al trabajador, un rato antes del turno, que avise al
comercio cuando sale. Mismo patrón que `checkin_reminder_sent_at` (0019): el
scheduler lo usa para no reenviar el push en cada pasada.

Revision ID: 0034
Revises: 0033
Create Date: 2026-09-26

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("departure_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "departure_reminder_sent_at")
