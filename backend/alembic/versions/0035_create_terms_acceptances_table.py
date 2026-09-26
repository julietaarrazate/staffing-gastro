"""create terms_acceptances table

Constancia de quién aceptó los términos y la política de privacidad, qué
versión, desde dónde (registro con email o con Google) y cuándo. Hasta acá el
checkbox del registro no dejaba nada guardado. Las cuentas creadas antes de
esta migración no tienen fila: no hay forma honesta de reconstruir cuándo
aceptaron.

Revision ID: 0035
Revises: 0034
Create Date: 2026-09-26

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "terms_acceptances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column(
            "accepted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_terms_acceptances_user_id", "terms_acceptances", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_terms_acceptances_user_id", table_name="terms_acceptances")
    op.drop_table("terms_acceptances")
