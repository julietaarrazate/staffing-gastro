"""add composite indices + CHECK constraints (production hardening)

Aditivo puro, sin cambio de comportamiento de la aplicación: el dominio ya
valida estas reglas en Python (Shift._validate_schedule, schemas Pydantic
con Field(ge=...)); esto es sólo una red de seguridad a nivel de base de
datos para el día que algo escriba fuera del dominio (script, migración de
datos, acceso directo en un incidente). Ver PRODUCTION_HARDENING.md y
docs/audits/2026-08-oido/05_DATABASE.md §3.

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-04

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # notifications: los índices simples en user_id y read ya existen
    # (0005); el compuesto es el filtro real de "no leídas de este
    # usuario" (docs/reference/DATABASE.md).
    op.create_index(
        "ix_notifications_user_id_read",
        "notifications",
        ["user_id", "read"],
    )
    # shift_applications: filtrar postulaciones pendientes de un turno
    # específico hoy sólo usa el índice de shift_id.
    op.create_index(
        "ix_shift_applications_shift_id_status",
        "shift_applications",
        ["shift_id", "status"],
    )

    with op.batch_alter_table("shifts") as batch_op:
        batch_op.create_check_constraint("ck_shifts_quantity_positive", "quantity > 0")
        batch_op.create_check_constraint(
            "ck_shifts_pay_amount_non_negative", "pay_amount >= 0"
        )
        batch_op.create_check_constraint(
            "ck_shifts_end_after_start", "end_at > start_at"
        )


def downgrade() -> None:
    with op.batch_alter_table("shifts") as batch_op:
        batch_op.drop_constraint("ck_shifts_end_after_start", type_="check")
        batch_op.drop_constraint("ck_shifts_pay_amount_non_negative", type_="check")
        batch_op.drop_constraint("ck_shifts_quantity_positive", type_="check")

    op.drop_index("ix_shift_applications_shift_id_status", table_name="shift_applications")
    op.drop_index("ix_notifications_user_id_read", table_name="notifications")
