"""postulaciones: el reconocimiento «Puedo ir ya» (carril urgente, 2026-11-27)

- `se_ofrecio_para_ya`: la persona tocó «Sí, puedo ir» al postularse a un turno
  que empezaba en menos de 6 horas. Se guarda al postular; si el comercio la
  acepta, el turno queda confirmado (ADR-0032). Las postulaciones que ya
  existen quedan en falso: nadie dijo «Puedo ir ya» antes de que existiera.

Revision ID: 0067
Revises: 0066 (la persona confirma el cobro)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0067"
down_revision: str | None = "0066"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shift_applications",
        sa.Column(
            "se_ofrecio_para_ya", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("shift_applications", "se_ofrecio_para_ya")
