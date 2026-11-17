"""soporte: referencia opcional a un turno o un comercio (U110)

- `support_tickets.shift_id` y `support_tickets.company_id`, nullables. Si el
  turno o el comercio se borran, el ticket queda sin la referencia (SET NULL).
- Las categorías nuevas `turno` y `comercio` no necesitan cambio de esquema:
  `category` es un `String(20)` sin restricción.

Revision ID: 0048
Revises: 0047 (encuesta para locales)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0048"
down_revision: str | None = "0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "support_tickets",
        sa.Column("shift_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "support_tickets",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_support_tickets_shift_id",
        "support_tickets",
        "shifts",
        ["shift_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_support_tickets_company_id",
        "support_tickets",
        "company_profiles",
        ["company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_support_tickets_shift_id", "support_tickets", ["shift_id"])
    op.create_index("ix_support_tickets_company_id", "support_tickets", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_support_tickets_company_id", table_name="support_tickets")
    op.drop_index("ix_support_tickets_shift_id", table_name="support_tickets")
    op.drop_constraint("fk_support_tickets_company_id", "support_tickets", type_="foreignkey")
    op.drop_constraint("fk_support_tickets_shift_id", "support_tickets", type_="foreignkey")
    op.drop_column("support_tickets", "company_id")
    op.drop_column("support_tickets", "shift_id")
