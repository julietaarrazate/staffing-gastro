"""turnos: la persona dice si cobró (2026-11-27)

- `worker_confirmed_paid_at`: la persona asignada confirmó «Sí, cobré».
- `worker_reported_unpaid_at`: la persona avisó «Todavía no cobré».
- `unpaid_report_ticket_id`: el ticket de soporte que abrió ese aviso (sin él,
  un reintento termina de avisar).

Oído no mueve plata: son registros, no cambian el estado del turno ni la
reputación de nadie.

Revision ID: 0066
Revises: 0065 (tope de avisos sin peso)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0066"
down_revision: str | None = "0065"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts", sa.Column("worker_confirmed_paid_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "shifts", sa.Column("worker_reported_unpaid_at", sa.DateTime(timezone=True), nullable=True)
    )


    op.add_column("shifts", sa.Column("unpaid_report_ticket_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("shifts", "unpaid_report_ticket_id")
    op.drop_column("shifts", "worker_reported_unpaid_at")
    op.drop_column("shifts", "worker_confirmed_paid_at")
