"""add cover_photo_url to company_profiles (foto del local)

La imagen grande de las tarjetas del feed y del detalle del turno. Hasta acá
se usaba el logo estirado a 800px, que en la mayoría de los comercios es un
isotipo chico sobre fondo liso: una tarjeta "con foto" que no mostraba el
lugar. Nullable: sin foto, el frontend vuelve al logo y después al color del
rubro, como antes.

Revision ID: 0033
Revises: 0032
Create Date: 2026-09-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "company_profiles", sa.Column("cover_photo_url", sa.String(length=512), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("company_profiles", "cover_photo_url")
