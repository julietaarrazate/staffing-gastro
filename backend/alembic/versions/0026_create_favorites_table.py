"""create favorites table (Favoritos y recontratación)

Bookmark privado del comercio sobre un trabajador, para encontrarlo rápido
la próxima vez que publique un turno. No tiene efecto sobre reputación,
matching ni ninguna otra métrica (ver docs/STATUS.md, auditoría de
producto 2026-08-10).

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-10

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("company_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "worker_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("worker_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "company_id", "worker_profile_id", name="uq_favorites_company_worker"
        ),
    )
    op.create_index("ix_favorites_company_id", "favorites", ["company_id"])
    op.create_index("ix_favorites_worker_profile_id", "favorites", ["worker_profile_id"])


def downgrade() -> None:
    op.drop_index("ix_favorites_worker_profile_id", table_name="favorites")
    op.drop_index("ix_favorites_company_id", table_name="favorites")
    op.drop_table("favorites")
