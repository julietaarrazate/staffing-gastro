"""trabajadores: tope a las cancelaciones con aviso que no pesan

- `notice_window_started_at`: cuándo empezó el período de 30 días en curso.
- `notice_cancellations_used`: cuántos avisos sin peso gastó en ese período
  (el tope son dos; ver `worker/domain/avisos.py`).

Revision ID: 0065
Revises: 0064 (puntualidad real)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0065"
down_revision: str | None = "0064"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles",
        sa.Column("notice_window_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "worker_profiles",
        sa.Column("notice_cancellations_used", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("worker_profiles", "notice_cancellations_used")
    op.drop_column("worker_profiles", "notice_window_started_at")
