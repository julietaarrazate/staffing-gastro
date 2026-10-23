"""cobro mensual con Mercado Pago (ADR-0022)

- `subscriptions`: `paid_until` (hasta cuándo está pago el plan), `renews`
  (False = dio de baja) y `expiry_notice` (último aviso de vencimiento).
- `subscription_payments`: un intento de pago por mes; `id` viaja como
  `external_reference` de la preferencia de Checkout Pro y `mp_payment_id`
  es único para que un pago no se acredite dos veces.

Revision ID: 0041
Revises: 0040
Create Date: 2026-10-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0041"
down_revision: str | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions", sa.Column("paid_until", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "subscriptions",
        sa.Column("renews", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("subscriptions", sa.Column("expiry_notice", sa.String(20), nullable=True))

    op.create_table(
        "subscription_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("company_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan_code", sa.String(40), nullable=False),
        sa.Column("amount_ars", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="ARS"),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("mp_payment_id", sa.String(40), nullable=True, unique=True),
        sa.Column("mp_preference_id", sa.String(80), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_subscription_payments_company_id", "subscription_payments", ["company_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_subscription_payments_company_id", table_name="subscription_payments")
    op.drop_table("subscription_payments")
    op.drop_column("subscriptions", "expiry_notice")
    op.drop_column("subscriptions", "renews")
    op.drop_column("subscriptions", "paid_until")
