"""create identity_claims and identity_evidences tables (EPIC-001, ADR-0010)

Dominio Identity (verificación de identidad) modelado como Claim + Evidence.
La evidencia sensible (DNI/selfie) se referencia por `data_url`, que se pone en
NULL tras la decisión (retención, docs/reference/IDENTITY_DATA_RETENTION.md).

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-06

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "identity_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("claim_type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.String(length=10), nullable=True),
        sa.Column("method", sa.String(length=20), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rejection_reason", sa.String(length=500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint(
            "user_id", "claim_type", name="uq_identity_claim_user_type"
        ),
    )
    op.create_index("ix_identity_claims_user_id", "identity_claims", ["user_id"])

    op.create_table(
        "identity_evidences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "claim_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity_claims.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("evidence_type", sa.String(length=20), nullable=False),
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("data_url", sa.String(length=512), nullable=True),
        sa.Column(
            "data_purged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_identity_evidences_claim_id", "identity_evidences", ["claim_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_identity_evidences_claim_id", table_name="identity_evidences")
    op.drop_table("identity_evidences")
    op.drop_index("ix_identity_claims_user_id", table_name="identity_claims")
    op.drop_table("identity_claims")
