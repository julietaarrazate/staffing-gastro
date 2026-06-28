"""create shift_applications table

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-28

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shift_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shift_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shifts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "worker_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worker_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "shift_id", "worker_profile_id", name="uq_shift_applications_shift_worker"
        ),
    )
    op.create_index(
        "ix_shift_applications_shift_id", "shift_applications", ["shift_id"]
    )
    op.create_index(
        "ix_shift_applications_worker_profile_id",
        "shift_applications",
        ["worker_profile_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_shift_applications_worker_profile_id", table_name="shift_applications"
    )
    op.drop_index("ix_shift_applications_shift_id", table_name="shift_applications")
    op.drop_table("shift_applications")
