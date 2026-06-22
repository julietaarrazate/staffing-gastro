"""create chat_messages table

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-22

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shift_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shifts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.String(length=2000), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_chat_messages_shift_id", "chat_messages", ["shift_id"])
    op.create_index(
        "ix_chat_messages_sender_user_id", "chat_messages", ["sender_user_id"]
    )
    op.create_index("ix_chat_messages_read", "chat_messages", ["read"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_read", table_name="chat_messages")
    op.drop_index("ix_chat_messages_sender_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_shift_id", table_name="chat_messages")
    op.drop_table("chat_messages")
