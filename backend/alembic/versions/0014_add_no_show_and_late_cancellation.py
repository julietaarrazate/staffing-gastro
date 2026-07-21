"""add no-show and late-cancellation reputation fields (ADR-0007)

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles",
        sa.Column("no_shows", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "company_profiles",
        sa.Column("late_cancellations", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "shifts", sa.Column("no_show_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "shifts",
        sa.Column(
            "last_no_show_worker_profile_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
    )
    op.create_foreign_key(
        "fk_shifts_last_no_show_worker_profile_id",
        "shifts",
        "worker_profiles",
        ["last_no_show_worker_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_shifts_last_no_show_worker_profile_id", "shifts", type_="foreignkey"
    )
    op.drop_column("shifts", "last_no_show_worker_profile_id")
    op.drop_column("shifts", "no_show_at")
    op.drop_column("company_profiles", "late_cancellations")
    op.drop_column("worker_profiles", "no_shows")
