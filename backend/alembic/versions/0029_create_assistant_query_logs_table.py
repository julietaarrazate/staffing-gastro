"""create assistant_query_logs table (señal de uso del asistente de IA)

Registra cada consulta al asistente del panel del comercio (texto + intención
resuelta) — base necesaria para un aprendizaje real futuro (P2, pedido de
Julieta: "que vaya aprendiendo"). Con el volumen de uso actual (beta) no hay
con qué entrenar nada todavía; esto sólo junta la materia prima para cuando
lo haya. Sin pipeline de entrenamiento en esta migración.

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-14

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assistant_query_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("company_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_assistant_query_logs_company_id", "assistant_query_logs", ["company_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_assistant_query_logs_company_id", table_name="assistant_query_logs")
    op.drop_table("assistant_query_logs")
