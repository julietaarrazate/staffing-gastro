"""turnos: marcas de la reconfirmación antes del turno (ADR-0031, P3)

Cuatro fechas por turno, de quien lo tiene ahora (se borran si cambia la
persona): cuándo se le preguntó a las 24 y a las 3 horas, cuándo contestó
«Sí, voy» y cuándo se le avisó al comercio que no contestó. Son marcas de
sistema: las escribe el scheduler sin subir la versión del turno.

Revision ID: 0063
Revises: 0062 (copia semanal de OpenStreetMap)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0063"
down_revision: str | None = "0062"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNAS = (
    "reconfirm_24h_sent_at",
    "reconfirm_3h_sent_at",
    "reconfirmed_at",
    "no_reconfirm_alert_sent_at",
)


def upgrade() -> None:
    for columna in _COLUMNAS:
        op.add_column(
            "shifts", sa.Column(columna, sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    for columna in reversed(_COLUMNAS):
        op.drop_column("shifts", columna)
