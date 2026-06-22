"""create reviews table

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-22

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shift_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shifts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewer_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewee_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        sa.UniqueConstraint(
            "shift_id", "reviewer_user_id", name="uq_reviews_shift_reviewer"
        ),
    )
    op.create_index("ix_reviews_shift_id", "reviews", ["shift_id"])
    op.create_index("ix_reviews_reviewer_user_id", "reviews", ["reviewer_user_id"])
    op.create_index("ix_reviews_reviewee_user_id", "reviews", ["reviewee_user_id"])


def downgrade() -> None:
    op.drop_index("ix_reviews_reviewee_user_id", table_name="reviews")
    op.drop_index("ix_reviews_reviewer_user_id", table_name="reviews")
    op.drop_index("ix_reviews_shift_id", table_name="reviews")
    op.drop_table("reviews")
