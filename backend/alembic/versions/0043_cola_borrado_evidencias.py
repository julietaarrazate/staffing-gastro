"""cola de borrado de los documentos de verificación (ADR-0021)

`identity_evidence_file_deletions`: los archivos de evidencia (DNI, selfie,
constancia de AFIP) que hay que borrar de Cloudinary. Al aprobar o rechazar,
el puntero pasa de `identity_evidences` a esta tabla en el mismo commit; la
fila se borra cuando Cloudinary confirma, y si falla se reintenta
(`next_attempt_at`). Sin FK al claim a propósito: si el claim o la cuenta se
borran, el archivo igual se tiene que borrar.

Revision ID: 0043
Revises: 0042
Create Date: 2026-10-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0043"
down_revision: str | None = "0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "identity_evidence_file_deletions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("public_id", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(10), nullable=False),
        sa.Column("file_format", sa.String(10), nullable=False, server_default=""),
        sa.Column("delivery_type", sa.String(20), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.String(500), nullable=True),
    )
    op.create_index(
        "ix_identity_evidence_file_deletions_next_attempt_at",
        "identity_evidence_file_deletions",
        ["next_attempt_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_identity_evidence_file_deletions_next_attempt_at",
        table_name="identity_evidence_file_deletions",
    )
    op.drop_table("identity_evidence_file_deletions")
