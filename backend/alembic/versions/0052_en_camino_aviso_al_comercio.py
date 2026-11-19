"""turnos: cuándo se avisó al comercio que la persona salió (U072)

- `shifts.en_route_announced_at`, nullable. Hasta ahora «¿ya se le avisó al
  comercio?» se leía de `en_route_at`, la hora de la última posición. Desde
  U072 esa posición se borra cuando la persona deja de compartir, así que el
  aviso necesita su propia marca: si no, apagar y volver a prender le
  mandaría otro «salió para tu local» al comercio.
- Datos que ya estaban: los viajes en curso (con `en_route_at`) ya avisaron;
  se copia esa hora.

Revision ID: 0052
Revises: 0051 (postulaciones: estado `desasignada`)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0052"
down_revision: str | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "shifts",
        sa.Column("en_route_announced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE shifts SET en_route_announced_at = en_route_at WHERE en_route_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("shifts", "en_route_announced_at")
