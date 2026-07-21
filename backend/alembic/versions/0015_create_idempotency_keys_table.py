"""create idempotency_keys table (product/IDEMPOTENCIA_SPEC.md)

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column(
            "response_body", postgresql.JSON(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_idempotency_keys_user_id", "idempotency_keys", ["user_id"]
    )
    op.create_index(
        "ix_idempotency_keys_created_at", "idempotency_keys", ["created_at"]
    )
    # Único parcial (spec): un mismo usuario no puede reservar dos veces la
    # misma key. `user_id` ya es NOT NULL, pero se deja el `WHERE` explícito
    # para blindar el índice ante un futuro uso con `user_id` nullable (p.
    # ej. acciones de sistema), sin tener que tocar el esquema después.
    op.create_index(
        "ux_idempotency_keys_user_id_key",
        "idempotency_keys",
        ["user_id", "key"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_idempotency_keys_user_id_key", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_created_at", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_user_id", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
