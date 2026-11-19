"""sesiones: cuándo se rotó cada refresh (ventana de gracia, ADR-0002)

- `refresh_sessions.rotated_at`, nullable. Cuándo se revocó la sesión por
  rotación (`/auth/refresh`), y no por cierre de sesión, contraseña nueva,
  suspensión o robo. Si el mismo token vuelve dentro de los 30 segundos
  siguientes (segunda pestaña, reintento tras una respuesta perdida) se
  emite un par nuevo en vez de cerrar todas las sesiones de la cuenta.
  `revoke_all_for_user` lo borra: después de una revocación en bloque el
  token viejo vuelve a ser robo.
- Datos que ya estaban: quedan en NULL. Las sesiones rotadas antes del
  deploy no tienen gracia, igual que hasta ahora.

Revision ID: 0059
Revises: 0058 (turno cerrado por la admin)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0059"
down_revision: str | None = "0058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "refresh_sessions",
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("refresh_sessions", "rotated_at")
