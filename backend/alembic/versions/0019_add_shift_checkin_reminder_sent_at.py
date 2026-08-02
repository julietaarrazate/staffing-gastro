"""add checkin_reminder_sent_at to shifts (ADR-0008: scheduler de asistencia)

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-02

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Marca cuándo se le mandó al trabajador el push de "marcá tu llegada",
    # para que el scheduler no lo reenvíe en cada tick (ver
    # attendance_scheduler.py).
    op.add_column(
        "shifts",
        sa.Column("checkin_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "checkin_reminder_sent_at")
