"""create shifts table

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.String(length=40), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pay_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="ARS"),
        sa.Column("tips", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("dress_code", sa.String(length=255), nullable=True),
        sa.Column("urgent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="borrador"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["company_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shifts_company_id", "shifts", ["company_id"])
    op.create_index("ix_shifts_position", "shifts", ["position"])
    op.create_index("ix_shifts_city", "shifts", ["city"])
    op.create_index("ix_shifts_urgent", "shifts", ["urgent"])
    op.create_index("ix_shifts_status", "shifts", ["status"])


def downgrade() -> None:
    op.drop_index("ix_shifts_status", table_name="shifts")
    op.drop_index("ix_shifts_urgent", table_name="shifts")
    op.drop_index("ix_shifts_city", table_name="shifts")
    op.drop_index("ix_shifts_position", table_name="shifts")
    op.drop_index("ix_shifts_company_id", table_name="shifts")
    op.drop_table("shifts")
