"""plan elegido al darse de alta y compromiso de pago (medición de la beta, M6)

Columnas nuevas en `subscriptions`, todas nullable y sin backfill:

- `chosen_plan_code` / `chosen_plan_at`: el plan que el comercio eligió en
  los precios de la landing; se guarda la primera vez y no se pisa.
- `payment_commitment_at` / `payment_commitment_plan_code` /
  `payment_commitment_price_ars`: el compromiso de pago («precio fundador»)
  que registra la admin a mano.

Revision ID: 0048
Revises: 0047 (encuesta para locales)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0048"
down_revision: str | None = "0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("chosen_plan_code", sa.String(40), nullable=True))
    op.add_column(
        "subscriptions", sa.Column("chosen_plan_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "subscriptions",
        sa.Column("payment_commitment_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "subscriptions", sa.Column("payment_commitment_plan_code", sa.String(40), nullable=True)
    )
    op.add_column(
        "subscriptions",
        sa.Column("payment_commitment_price_ars", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "payment_commitment_price_ars")
    op.drop_column("subscriptions", "payment_commitment_plan_code")
    op.drop_column("subscriptions", "payment_commitment_at")
    op.drop_column("subscriptions", "chosen_plan_at")
    op.drop_column("subscriptions", "chosen_plan_code")
