"""chat por asignación: cada mensaje queda atado a la persona del hilo

El chat se guardaba por turno. Un turno que se reasigna (rechazo, baja del
trabajador, ausencia) pasa por más de una persona, y la conversación del
comercio es con UNA: con quien estaba asignado cuando se escribió cada mensaje.

- `chat_messages.worker_user_id` (nullable, FK a `users`, `ON DELETE CASCADE`
  igual que `sender_user_id`): el trabajador del hilo. Con `shift_id`
  identifica la conversación; la app lee y escribe siempre por hilo.
- Índice `(worker_user_id, shift_id, created_at)`: mensajes de un hilo en
  orden, último mensaje y no leídos por hilo. Con `worker_user_id` adelante
  también le sirve a la clave foránea nueva. El `(shift_id, created_at)` de la
  0040 se queda (clave foránea a `shifts`).

Relleno de los mensajes que ya existían. La regla es conservadora: un mensaje
sólo entra a un hilo si se sabe con quién se estaba hablando; si hay duda queda
sin hilo (`NULL`) y la app no se lo muestra a nadie. No se borra nada.

1. Mensaje escrito por un trabajador (su autor no es el comercio del turno y
   tiene perfil de trabajador): es de su propio hilo. Sólo pudo escribirlo
   mientras estaba asignado.
2. Mensaje escrito por el comercio: entra a un hilo sólo si en los datos de ese
   turno aparece UNA única persona con la que pudo estar hablando. Cuentan
   como personas del turno: quienes escribieron en su chat, quien está asignado
   hoy, quien quedó registrado como ausente (`last_no_show_worker_profile_id`)
   y quienes tienen una postulación `aceptada` (se acepta al asignar). Si
   aparece más de una, o ninguna, no hay forma de saber a cuál le hablaba el
   comercio en cada mensaje (no se guardó el historial de asignaciones): queda
   sin hilo.

Límite conocido de (2): una persona asignada directo (sin postularse), que no
escribió y dejó el turno sin que se la marcara ausente no deja rastro. Si el
resto del turno muestra a una sola persona, lo que el comercio le haya escrito
a aquélla queda en el hilo de ésta. Son mensajes del comercio, nunca de otro
trabajador: los de un trabajador siempre quedan en su propio hilo (1).

SQL estándar a propósito (subconsultas correlacionadas, sin `UPDATE ... FROM`
ni agregados sobre UUID): corre igual en Postgres y en el SQLite de los tests
(`tests/test_chat_migracion_hilos.py` ejecuta estas mismas sentencias).

El `downgrade` saca la columna y, con ella, la separación por hilo: no hay
vuelta atrás de los datos sin volver también el código, que desde esta
migración lee y escribe siempre por hilo.

Revision ID: 0045
Revises: 0044
Create Date: 2026-11-11

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0045"
down_revision: str | None = "0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "ix_chat_messages_worker_user_id_shift_id_created_at"
_FK = "fk_chat_messages_worker_user_id"

# El usuario del comercio dueño del turno del mensaje.
_COMERCIO_DEL_TURNO = """
    SELECT cp.user_id
      FROM shifts s
      JOIN company_profiles cp ON cp.id = s.company_id
     WHERE s.id = chat_messages.shift_id
"""

# (turno, usuario) de cada persona con la que el comercio pudo estar hablando.
# `UNION` (no `UNION ALL`): una fila por persona aunque aparezca por más de un
# camino.
_PERSONAS_DEL_TURNO = """
    SELECT m.shift_id AS shift_id, m.sender_user_id AS user_id
      FROM chat_messages m
      JOIN shifts s ON s.id = m.shift_id
      JOIN company_profiles cp ON cp.id = s.company_id
     WHERE m.sender_user_id <> cp.user_id
    UNION
    SELECT s.id, wp.user_id
      FROM shifts s
      JOIN worker_profiles wp ON wp.id = s.worker_profile_id
    UNION
    SELECT s.id, wp.user_id
      FROM shifts s
      JOIN worker_profiles wp ON wp.id = s.last_no_show_worker_profile_id
    UNION
    SELECT a.shift_id, wp.user_id
      FROM shift_applications a
      JOIN worker_profiles wp ON wp.id = a.worker_profile_id
     WHERE a.status = 'aceptada'
"""

# Regla 1: lo que escribió un trabajador es de su hilo.
_RELLENO_DEL_TRABAJADOR = f"""
UPDATE chat_messages
   SET worker_user_id = sender_user_id
 WHERE worker_user_id IS NULL
   AND sender_user_id <> ({_COMERCIO_DEL_TURNO})
   AND EXISTS (
       SELECT 1 FROM worker_profiles wp
        WHERE wp.user_id = chat_messages.sender_user_id
   )
"""

# Regla 2: lo que escribió el comercio, sólo si el turno tuvo una única persona.
_RELLENO_DEL_COMERCIO = f"""
UPDATE chat_messages
   SET worker_user_id = (
       SELECT p.user_id
         FROM ({_PERSONAS_DEL_TURNO}) p
        WHERE p.shift_id = chat_messages.shift_id
        LIMIT 1
   )
 WHERE worker_user_id IS NULL
   AND sender_user_id = ({_COMERCIO_DEL_TURNO})
   AND (
       SELECT COUNT(*)
         FROM ({_PERSONAS_DEL_TURNO}) p
        WHERE p.shift_id = chat_messages.shift_id
   ) = 1
"""

# En orden: la regla 2 no depende de lo que escribió la 1 (las personas del
# turno se calculan por autor, no por la columna nueva).
RELLENO: tuple[str, ...] = (_RELLENO_DEL_TRABAJADOR, _RELLENO_DEL_COMERCIO)


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("worker_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        _FK,
        "chat_messages",
        "users",
        ["worker_user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    for sentencia in RELLENO:
        op.execute(sentencia)
    op.create_index(_INDEX, "chat_messages", ["worker_user_id", "shift_id", "created_at"])


def downgrade() -> None:
    op.drop_index(_INDEX, table_name="chat_messages")
    op.drop_constraint(_FK, "chat_messages", type_="foreignkey")
    op.drop_column("chat_messages", "worker_user_id")
