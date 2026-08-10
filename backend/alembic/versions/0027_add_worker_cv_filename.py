"""add cv_filename to worker_profiles (F1, auditoría de producto 2026-08-10)

Cloudinary asigna un `public_id` (hash) al subir sin firma — la URL sola no
alcanza para mostrar un nombre de archivo legible en la UI.

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-10

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles",
        sa.Column("cv_filename", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("worker_profiles", "cv_filename")
