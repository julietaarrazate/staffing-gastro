"""usuarios: de qué enlace llegó cada alta (fase 0 del plan de crecimiento)

Una columna en `users`, nullable y sin datos que copiar:

- `signup_origin`: la etiqueta del enlace con el que llegó la persona
  (`?ref=`, o `utm_source` y `utm_campaign`; «directo» si no traía nada).
  La fija el alta pública (`identity/domain/origen_alta.py`). Las cuentas
  anteriores a esta migración y las internas (invitadas, de prueba, seed)
  quedan en NULL, y el panel de admin las muestra como «Sin dato».

Revision ID: 0056
Revises: 0055 (turnos: no cubiertos con la cuenta del comercio suspendida)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0056"
down_revision: str | None = "0055"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("signup_origin", sa.String(81), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "signup_origin")
