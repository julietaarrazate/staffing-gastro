"""add event_id/event_name to shifts (publicación masiva para un evento)

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-01

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Sin tabla `events` ni FK: `event_id` es sólo un UUID compartido entre
    # los turnos individuales creados en una misma publicación masiva (cada
    # uno sigue siendo un turno normal, quantity=1 — ADR-0003 no se toca).
    # Agrupar/contar el progreso de un evento es un simple `WHERE event_id = X`.
    op.add_column("shifts", sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("shifts", sa.Column("event_name", sa.String(length=200), nullable=True))
    op.create_index("ix_shifts_event_id", "shifts", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_shifts_event_id", table_name="shifts")
    op.drop_column("shifts", "event_name")
    op.drop_column("shifts", "event_id")
