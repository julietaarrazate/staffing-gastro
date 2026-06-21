"""add worker_profile_id to shifts (asignación)

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("worker_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_shifts_worker_profile_id", "shifts", ["worker_profile_id"]
    )
    op.create_foreign_key(
        "fk_shifts_worker_profile_id",
        "shifts",
        "worker_profiles",
        ["worker_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_shifts_worker_profile_id", "shifts", type_="foreignkey")
    op.drop_index("ix_shifts_worker_profile_id", table_name="shifts")
    op.drop_column("shifts", "worker_profile_id")
