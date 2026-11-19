"""CV protegido y constancia de lo borrado (ADR-0021, actualización 2026-11-19)

- `worker_profiles.cv_public_id`, `cv_resource_type`, `cv_format` y
  `cv_delivery_type`, nullable: la referencia al archivo protegido
  (`authenticated`) del CV en Cloudinary, no una URL. Se ve con un link que
  vence (`GET /workers/{id}/cv-link`).
- `cv_url` queda para un link pegado a mano y, hasta correr
  `scripts/privatize_worker_cvs.py`, para la URL pública de los CV subidos
  antes de este cambio. El script los pasa a protegidos y vacía `cv_url`.
- `identity_evidence_file_deletions.deleted_at`, nullable, e índice por
  `public_id`: al confirmar un borrado la fila ya no se borra, queda marcada.
  Así se sabe qué archivos se mandaron a borrar, y un formulario abierto
  desde antes no puede volver a poner un CV que la persona ya cambió.
- Datos que ya estaban: no se tocan acá (el cambio de tipo es en Cloudinary;
  lo hacen los scripts).

`downgrade` borra las columnas del CV: los perfiles que ya tenían un CV
protegido pierden la referencia (el archivo sigue en Cloudinary, sin que
nada lo apunte, y la app vieja no lo puede mostrar). También borra
`deleted_at`: las filas ya borradas volverían a parecer pendientes, así que
antes de bajar hay que sacarlas (`DELETE … WHERE deleted_at IS NOT NULL`).

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
    op.add_column(
        "identity_evidence_file_deletions",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_identity_evidence_file_deletions_public_id",
        "identity_evidence_file_deletions",
        ["public_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_identity_evidence_file_deletions_public_id",
        table_name="identity_evidence_file_deletions",
    )
    op.drop_column("identity_evidence_file_deletions", "deleted_at")
    op.drop_column("worker_profiles", "cv_delivery_type")
    op.drop_column("worker_profiles", "cv_format")
    op.drop_column("worker_profiles", "cv_resource_type")
    op.drop_column("worker_profiles", "cv_public_id")
