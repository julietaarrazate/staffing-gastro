"""evidencias de identidad privadas (ADR-0021)

`identity_evidences` guarda la referencia al archivo privado en Cloudinary
(`public_id`, tipo de recurso, formato, tipo de entrega) en vez de una URL
pública. `data_url` queda para las evidencias viejas hasta que corre
`scripts/privatize_identity_evidence.py`.

Revision ID: 0039
Revises: 0038
Create Date: 2026-10-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "identity_evidences",
        sa.Column("file_public_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "identity_evidences",
        sa.Column("file_resource_type", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "identity_evidences",
        sa.Column("file_format", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "identity_evidences",
        sa.Column("file_delivery_type", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("identity_evidences", "file_delivery_type")
    op.drop_column("identity_evidences", "file_format")
    op.drop_column("identity_evidences", "file_resource_type")
    op.drop_column("identity_evidences", "file_public_id")
