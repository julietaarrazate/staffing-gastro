"""add payments_recorded to company_profiles (reputación: on_time_payment_rate real)

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-02

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Contador interno (no se expone en la API): cuántos pagos se registraron
    # hasta ahora, para ponderar el promedio móvil de `on_time_payment_rate`
    # (distinto de `events_published`, que cuenta turnos publicados, no
    # pagados — ver `ShiftService.mark_paid`).
    op.add_column(
        "company_profiles",
        sa.Column("payments_recorded", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("company_profiles", "payments_recorded")
