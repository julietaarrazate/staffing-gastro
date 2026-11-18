"""turnos: «no cubierto» con la cuenta del comercio suspendida (decisión 22)

- `shifts.not_covered_while_suspended`, booleano NOT NULL con default falso.
  Los turnos abiertos de un comercio suspendido quedan ocultos (ADR-0024) y,
  cuando su horario pasa, vencen igual («no cubierto», ADR-0015), pero sin
  aviso a la cuenta suspendida y fuera de las métricas de cobertura. La marca
  va en el turno porque la cuenta puede reactivarse después y el turno no
  tiene que volver a contar.
- Datos que ya estaban: quedan en falso. No se puede saber hacia atrás si la
  cuenta estaba suspendida cuando venció cada turno.

Revision ID: 0055
Revises: 0052 (turnos: aviso de «en camino» al comercio)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0055"
down_revision: str | None = "0053"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column(
            "not_covered_while_suspended",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("shifts", "not_covered_while_suspended")
