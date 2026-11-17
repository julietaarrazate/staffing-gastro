"""encuesta para locales (ADR-0024)

- `survey_responses`: una fila por respuesta a la encuesta pública. Sin IP.
  El contacto (`contact_name`, `business_name`, `phone`, `email`) es opcional,
  exige `consent_at` y se borra a los 12 meses (`created_at`); la respuesta
  queda como estadística anónima.
- `client_key` único: la clave de reintento del cliente (un reintento no
  duplica).

Revision ID: 0046
Revises: 0045 (chat por asignación)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0046"
down_revision: str | None = "0045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "survey_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("local_kind", sa.String(20), nullable=False),
        sa.Column("barrio", sa.String(80), nullable=True),
        sa.Column("team_model", sa.String(20), nullable=False),
        sa.Column("eventuals_normal_month", sa.String(12), nullable=False),
        sa.Column("eventuals_peak_month", sa.String(12), nullable=False),
        sa.Column("roles", sa.JSON(), nullable=False),
        sa.Column("current_channels", sa.JSON(), nullable=False),
        sa.Column("pay_per_shift_ars", sa.Integer(), nullable=True),
        sa.Column("last_absence_outcome", sa.JSON(), nullable=False),
        sa.Column("pricing_preference", sa.String(20), nullable=False),
        sa.Column("wants_beta", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("contact_name", sa.String(120), nullable=True),
        sa.Column("business_name", sa.String(160), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(60), nullable=True),
        sa.Column("client_key", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("client_key", name="uq_survey_responses_client_key"),
    )
    op.create_index("ix_survey_responses_created_at", "survey_responses", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_survey_responses_created_at", table_name="survey_responses")
    op.drop_table("survey_responses")
