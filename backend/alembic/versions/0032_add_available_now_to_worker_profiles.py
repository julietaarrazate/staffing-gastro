"""add available_now columns to worker_profiles ("Disponible ahora", ADR-0014)

Una sola posición capturada al prender el estado, vigente por
`AVAILABLE_NOW_TTL` (4h) o hasta apagarla — nunca un seguimiento continuo
(alternativa descartada explícitamente en el ADR: "vigilancia de alguien que
todavía no está trabajando"). Reemplaza a latitude/longitude del perfil para
medir distancia mientras está vigente; fuera de esa ventana, matching y mapa
vuelven solos a la zona del perfil (`WorkerProfile.is_available_now`).

Mismo criterio que `en_route_*` en `shifts` (migración 0031): tres columnas
nullable, no una tabla de posiciones — el dato se pisa en cada activación y
se borra al apagar/vencer/cerrar sesión, así que nunca hace falta historial.

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-16

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "worker_profiles", sa.Column("available_now_latitude", sa.Float(), nullable=True)
    )
    op.add_column(
        "worker_profiles", sa.Column("available_now_longitude", sa.Float(), nullable=True)
    )
    op.add_column(
        "worker_profiles",
        sa.Column("available_now_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("worker_profiles", "available_now_until")
    op.drop_column("worker_profiles", "available_now_longitude")
    op.drop_column("worker_profiles", "available_now_latitude")
