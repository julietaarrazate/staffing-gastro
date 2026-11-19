"""users.birth_date: fecha de nacimiento declarada en el alta

Revision ID: 0048
Revises: 0047
Create Date: 2026-11-17

U101 (etapa 3 de la beta, decisión de Julieta del 2026-11-17): el alta pide
la fecha de nacimiento y no deja crear la cuenta a menores de 18. Nula en las
cuentas que ya existían y en las internas (invitadas, seed): no se inventa.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0048"
down_revision: str | None = "0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "birth_date")
