"""add en_route location columns to shifts ("va en camino")

Última posición conocida del trabajador mientras viaja a un turno confirmado,
para que el comercio vea que está llegando (pedido de Julieta: "que muestre la
ruta del trabajador yendo al local, como hace Rappi, eso genera tranquilidad al
comercio").

Tres columnas en `shifts` y no una tabla de posiciones a propósito: el dato se
PISA en cada reporte y se borra al llegar, así que nunca hay más de una fila
por turno. Sin historial de recorrido no hay nada que retener ni que custodiar
—la ubicación de una persona es dato personal (Ley 25.326)— y la función
cumple igual: el comercio necesita "dónde está ahora", no por dónde anduvo.
Las reglas de cuándo se acepta y cuándo se borra viven en el dominio
(`Shift.report_en_route_location` / `_clear_en_route`).

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-07

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("shifts", sa.Column("en_route_latitude", sa.Float(), nullable=True))
    op.add_column("shifts", sa.Column("en_route_longitude", sa.Float(), nullable=True))
    op.add_column(
        "shifts",
        sa.Column("en_route_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("shifts", "en_route_at")
    op.drop_column("shifts", "en_route_longitude")
    op.drop_column("shifts", "en_route_latitude")
