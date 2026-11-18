"""postulaciones: estado `desasignada` con su motivo (G4: U021, U123)

- `shift_applications.motivo` (`rechazo`, `cancelacion`, `ausencia`), nullable,
  con un CHECK: lleva motivo la postulación `desasignada`, y sólo ella. El
  estado nuevo no necesita cambio de esquema (`status` es un `String(20)`).
- Datos que ya estaban. Antes de este cambio, cuando la persona asignada
  rechazaba, cancelaba o faltaba, su postulación quedaba `aceptada` para
  siempre. En los turnos que siguen vivos (abiertos, o que hoy tiene otra
  persona; los terminados y cancelados no se tocan):
    * si el turno registra su ausencia (`last_no_show_worker_profile_id`),
      pasa a `desasignada` con motivo `ausencia`;
    * si no, no se puede saber si rechazó o canceló, y no se inventa: pasa a
      `retirada` (sale de la lista y puede volver a postularse).
  Y en los turnos que hoy tienen a alguien asignado, la postulación `retirada`
  de esa persona (se la asignó desde «Recomendados» después de retirarla) pasa
  a `aceptada`, que es lo que el código hace desde ahora al asignar.
- La vuelta atrás deja las `desasignada` como `aceptada`, que es como estaban
  antes (también las de quien fue asignado sin postularse, que antes no
  tenían fila: no hay cómo distinguirlas).

Revision ID: 0051
Revises: 0050 (soporte: referencia a un turno o un comercio)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0051"
down_revision: str | None = "0050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CHECK = "ck_shift_applications_motivo_desasignada"

# Turnos que siguen vivos: los abiertos y los que hoy tiene otra persona.
_TURNO_VIVO = "s.status NOT IN ('finalizado', 'pagado', 'cancelado', 'no_cubierto')"

# La persona de esta postulación ya no es la asignada al turno.
_YA_NO_ASIGNADA = (
    "(s.worker_profile_id IS NULL "
    "OR s.worker_profile_id <> shift_applications.worker_profile_id)"
)


def upgrade() -> None:
    op.add_column("shift_applications", sa.Column("motivo", sa.String(20), nullable=True))

    op.execute(
        "UPDATE shift_applications SET status = 'desasignada', motivo = 'ausencia' "
        "WHERE status = 'aceptada' AND EXISTS ("
        "SELECT 1 FROM shifts s WHERE s.id = shift_applications.shift_id "
        f"AND {_TURNO_VIVO} "
        "AND s.last_no_show_worker_profile_id = shift_applications.worker_profile_id "
        f"AND {_YA_NO_ASIGNADA})"
    )
    op.execute(
        "UPDATE shift_applications SET status = 'retirada' "
        "WHERE status = 'aceptada' AND EXISTS ("
        "SELECT 1 FROM shifts s WHERE s.id = shift_applications.shift_id "
        f"AND {_TURNO_VIVO} "
        f"AND {_YA_NO_ASIGNADA})"
    )
    op.execute(
        "UPDATE shift_applications SET status = 'aceptada' "
        "WHERE status = 'retirada' AND EXISTS ("
        "SELECT 1 FROM shifts s WHERE s.id = shift_applications.shift_id "
        "AND s.status IN ('asignado', 'confirmado', 'en_camino', 'check_in', "
        "'trabajando', 'check_out') "
        "AND s.worker_profile_id = shift_applications.worker_profile_id)"
    )

    op.create_check_constraint(
        _CHECK,
        "shift_applications",
        "(status = 'desasignada') = (motivo IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(_CHECK, "shift_applications", type_="check")
    op.execute("UPDATE shift_applications SET status = 'aceptada' WHERE status = 'desasignada'")
    op.drop_column("shift_applications", "motivo")
