"""leads: copia semanal de OpenStreetMap por barrio (ADR-0029)

«Traer comercios del barrio» dejó de consultar Overpass en vivo: los
servidores públicos están saturados y desde Render fallaba siempre (502). Un
chequeo del scheduler baja cada barrio de a uno, en serie, cuando su copia
tiene más de 7 días, y la importación lee de acá.

- `lead_snapshot_barrios`: de cuándo es la copia de cada barrio. Aparte de
  los comercios para que una copia vacía cuente como copia.
- `lead_place_snapshots`: los comercios de cada copia (los campos de
  `PlaceCandidate`), únicos por (barrio, osm_ref). Se reemplazan enteros por
  barrio cuando la consulta sale bien.

Tablas nuevas y vacías: no tocan `leads` ni hace falta `CONCURRENTLY`.

Revision ID: 0062
Revises: 0061 (índices de ausencias)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0062"
down_revision: str | None = "0061"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_snapshot_barrios",
        sa.Column("barrio", sa.String(60), primary_key=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("places", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "lead_place_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("barrio", sa.String(60), nullable=False),
        sa.Column("osm_ref", sa.String(40), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("address", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(60), nullable=True),
        sa.Column("website", sa.String(300), nullable=True),
        sa.Column("instagram", sa.String(300), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        # El único (barrio, osm_ref) también sirve de índice para leer la
        # copia de un barrio (columna de adelante).
        sa.UniqueConstraint(
            "barrio", "osm_ref", name="uq_lead_place_snapshots_barrio_osm_ref"
        ),
    )


def downgrade() -> None:
    op.drop_table("lead_place_snapshots")
    op.drop_table("lead_snapshot_barrios")
