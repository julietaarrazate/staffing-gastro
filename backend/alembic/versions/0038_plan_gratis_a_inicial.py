"""plan gratis -> inicial

Sin plan gratis desde el ADR-0020: las suscripciones que estaban en `gratis`
pasan al plan de entrada pago `inicial`. Solo datos, sin cambio de esquema.

Revision ID: 0038
Revises: 0037
Create Date: 2026-10-22

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE subscriptions SET plan_code = 'inicial' WHERE plan_code = 'gratis'")


def downgrade() -> None:
    op.execute("UPDATE subscriptions SET plan_code = 'gratis' WHERE plan_code = 'inicial'")
