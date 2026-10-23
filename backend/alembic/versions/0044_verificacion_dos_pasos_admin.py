"""verificación en dos pasos de las cuentas admin (ADR-0023)

- `user_two_factor`: secreto TOTP vigente y pendiente (cifrados con
  `TWO_FACTOR_ENCRYPTION_KEY`), cuándo se activó y el último paso usado
  (anti-replay). Una fila por cuenta.
- `two_factor_recovery_codes`: sha256 de cada código de recuperación;
  `used_at` lo vuelve de un solo uso.
- `two_factor_challenges`: el paso entre la contraseña y el código del login
  (sha256 del token, vence a los 5 min, cuenta los errores).

Revision ID: 0044
Revises: 0042 (la 0043 la tiene reservada otro PR que todavía no está en
main; si se mergea antes que éste, hay que pasar `down_revision` a "0043")
Create Date: 2026-10-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0044"
down_revision: str | None = "0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_two_factor",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("secret_encrypted", sa.String(512), nullable=True),
        sa.Column("pending_secret_encrypted", sa.String(512), nullable=True),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_step", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    op.create_table(
        "two_factor_recovery_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_two_factor_recovery_codes_user_id", "two_factor_recovery_codes", ["user_id"]
    )

    op.create_table(
        "two_factor_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_two_factor_challenges_token_hash",
        "two_factor_challenges",
        ["token_hash"],
        unique=True,
    )
    op.create_index("ix_two_factor_challenges_user_id", "two_factor_challenges", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_two_factor_challenges_user_id", table_name="two_factor_challenges")
    op.drop_index("ix_two_factor_challenges_token_hash", table_name="two_factor_challenges")
    op.drop_table("two_factor_challenges")
    op.drop_index(
        "ix_two_factor_recovery_codes_user_id", table_name="two_factor_recovery_codes"
    )
    op.drop_table("two_factor_recovery_codes")
    op.drop_table("user_two_factor")
