"""create worker and company profile tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "worker_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("photo_url", sa.String(length=512), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("bio", sa.String(length=1000), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("years_experience", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("languages", sa.JSON(), nullable=False),
        sa.Column("certifications", sa.JSON(), nullable=False),
        sa.Column("cv_url", sa.String(length=512), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rating", sa.Float(), nullable=False, server_default="0"),
        sa.Column("events_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("punctuality_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cancellations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("badges", sa.JSON(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="bronce"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_worker_profiles_user_id", "worker_profiles", ["user_id"], unique=True
    )

    op.create_table(
        "company_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("logo_url", sa.String(length=512), nullable=True),
        sa.Column("category", sa.String(length=40), nullable=True),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("opening_hours", sa.String(length=255), nullable=True),
        sa.Column("rating", sa.Float(), nullable=False, server_default="0"),
        sa.Column("events_published", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("on_time_payment_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_company_profiles_user_id", "company_profiles", ["user_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_company_profiles_user_id", table_name="company_profiles")
    op.drop_table("company_profiles")
    op.drop_index("ix_worker_profiles_user_id", table_name="worker_profiles")
    op.drop_table("worker_profiles")
