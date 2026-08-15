"""create saved_shifts table (Turnos guardados por el trabajador)

Bookmark privado del trabajador sobre un turno abierto, para evaluarlo
después sin postularse todavía (pedido de Julieta: "así comienza algo más
de evaluar opciones que convengan"). No tiene efecto sobre matching,
postulación ni reputación — mismo criterio que `favorites` (bookmark
comercio → trabajador, ver 0026).

Revision ID: 0030
Revises: 0029
Create Date: 2026-08-15

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "worker_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worker_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shift_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shifts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "worker_profile_id", "shift_id", name="uq_saved_shifts_worker_shift"
        ),
    )
    op.create_index("ix_saved_shifts_worker_profile_id", "saved_shifts", ["worker_profile_id"])
    op.create_index("ix_saved_shifts_shift_id", "saved_shifts", ["shift_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_shifts_shift_id", table_name="saved_shifts")
    op.drop_index("ix_saved_shifts_worker_profile_id", table_name="saved_shifts")
    op.drop_table("saved_shifts")
