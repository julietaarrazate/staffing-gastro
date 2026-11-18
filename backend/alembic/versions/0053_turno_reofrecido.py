"""turnos: reofrecer un turno ya empezado y pagar lo que resta (U080)

Tres columnas en `shifts`, las tres nullable y sin datos que copiar:

- `reoffered_at`: cuándo se volvió a ofrecer un turno que se reabrió con el
  horario ya empezado. Mientras esté, el turno se ofrece hasta `end_at`.
- `confirmed_at`: cuándo confirmó la persona que tiene el turno ahora. Para
  quien toma un turno ya empezado, el recordatorio de llegada y la ausencia
  se cuentan desde acá. Los turnos confirmados antes de esta migración quedan
  en NULL: se les sigue contando desde `start_at`, como hasta hoy.
- `prorated_pay_amount`: lo que se paga por un turno reofrecido, fijado
  cuando el reemplazo marca la llegada. NULL = se paga `pay_amount`.

Revision ID: 0053
Revises: 0052 (turnos: aviso al comercio de «va en camino»)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0053"
down_revision: str | None = "0052"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("shifts", sa.Column("reoffered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("shifts", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "shifts", sa.Column("prorated_pay_amount", sa.Numeric(12, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("shifts", "prorated_pay_amount")
    op.drop_column("shifts", "confirmed_at")
    op.drop_column("shifts", "reoffered_at")
