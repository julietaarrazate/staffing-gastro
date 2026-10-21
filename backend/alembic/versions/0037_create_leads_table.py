"""create leads table

Lista de comercios gastronómicos a captar para la beta (panel de admin,
`/admin/leads`). Los datos del comercio vienen de OpenStreetMap; estado,
notas y fecha de contacto son del seguimiento. `osm_ref` único hace
idempotente volver a importar un barrio (ADR-0019).

Revision ID: 0037
Revises: 0036
Create Date: 2026-10-20

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0037"
down_revision: str | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("osm_ref", sa.String(40), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("barrio", sa.String(60), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("address", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(60), nullable=True),
        sa.Column("website", sa.String(300), nullable=True),
        sa.Column("instagram", sa.String(300), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="nuevo"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("contacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("osm_ref", name="uq_leads_osm_ref"),
    )
    op.create_index("ix_leads_barrio", "leads", ["barrio"])
    op.create_index("ix_leads_status", "leads", ["status"])


def downgrade() -> None:
    op.drop_index("ix_leads_status", table_name="leads")
    op.drop_index("ix_leads_barrio", table_name="leads")
    op.drop_table("leads")
