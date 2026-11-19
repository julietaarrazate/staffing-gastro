"""perfil del trabajador: el CV subido pasa a privado (ADR-0021, actualización 2026-11-19)

- `worker_profiles.cv_public_id`, `cv_resource_type`, `cv_format` y
  `cv_delivery_type`, nullable: la referencia al archivo privado del CV en
  Cloudinary (no una URL). Se ve con un link que vence
  (`GET /workers/{id}/cv-link`).
- `cv_url` queda para un link pegado a mano y, hasta correr
  `scripts/privatize_worker_cvs.py`, para la URL pública de los CV subidos
  antes de este cambio. El script los pasa a privados y vacía `cv_url`.
- Datos que ya estaban: no se tocan acá (el cambio de tipo es en Cloudinary;
  lo hace el script).

Revision ID: 0060
Revises: 0058 (la 0059 es de otra rama: al integrar, re-encadenar)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0060"
down_revision: str | None = "0058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles", sa.Column("cv_public_id", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "worker_profiles", sa.Column("cv_resource_type", sa.String(length=10), nullable=True)
    )
    op.add_column(
        "worker_profiles", sa.Column("cv_format", sa.String(length=10), nullable=True)
    )
    op.add_column(
        "worker_profiles", sa.Column("cv_delivery_type", sa.String(length=20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("worker_profiles", "cv_delivery_type")
    op.drop_column("worker_profiles", "cv_format")
    op.drop_column("worker_profiles", "cv_resource_type")
    op.drop_column("worker_profiles", "cv_public_id")
