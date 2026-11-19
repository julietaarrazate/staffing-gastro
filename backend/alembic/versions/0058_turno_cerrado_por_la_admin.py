"""turnos: registro de «Cerrar turno» de la admin (decisión 21, ADR-0024)

- `shifts.closed_by_admin_at` y `shifts.closed_by_admin_user_id`, nullable.
  Cuándo y quién marcó la salida o cerró un turno empezado en nombre de una
  cuenta suspendida, que ya no puede entrar a la app. Sin FK a `users`: es un
  registro y no tiene que trabar el borrado de la cuenta de la admin.
- Datos que ya estaban: ninguno lo tiene (la acción es nueva).

Revision ID: 0058
Revises: 0057 (origen del alta, #650)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0058"
down_revision: str | None = "0057"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("closed_by_admin_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "shifts",
        sa.Column("closed_by_admin_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "closed_by_admin_user_id")
    op.drop_column("shifts", "closed_by_admin_at")
