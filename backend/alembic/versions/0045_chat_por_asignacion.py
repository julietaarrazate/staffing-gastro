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
sólo entra a un hilo si hay rastro de con quién se estaba hablando EN ESE
MENSAJE; si hay duda queda sin hilo (`NULL`) y la app no se lo muestra a nadie.
No se borra nada.

1. Mensaje escrito por un trabajador (su autor no es el comercio del turno y
   tiene perfil de trabajador): es de su propio hilo. Sólo pudo escribirlo
   mientras estaba asignado.
2. Mensaje escrito por el comercio: es del hilo de su destinatario, y el
   destinatario sale del aviso que generó ese mismo mensaje. Cada mensaje dejó
   un aviso `chat_message` a quien estaba asignado, con link `/chats/<turno>`
   y el comienzo del texto (`_SNIPPET_MAX` de `chat/application/services.py`:
   el texto entero hasta 80 caracteres; si no, los primeros 77 y `...`). El
   mensaje entra al hilo de esa persona sólo si:
   - ningún otro mensaje del comercio en ese turno tiene el mismo comienzo de
     texto (así el aviso que coincide es, sin duda, el de este mensaje), y
   - hay exactamente un aviso que coincide, y su destinatario es trabajador.
   Si el aviso ya no está (la limpieza borra los leídos de más de 90 días, o
   se borró la cuenta) o el texto se repite en el turno, queda sin hilo.

   No alcanza con mirar quiénes pasaron por el turno: alguien asignado directo
   desde «Recomendados» (sin postularse) que no escribió y dejó el turno sin
   quedar ausente no deja otro rastro que esos avisos, y una regla por turno le
   atribuiría a quien vino después lo que el comercio le escribió a aquélla.

Las dos sentencias de `RELLENO` sólo tocan mensajes sin hilo y exigen rastro
por mensaje, así que repetirlas no mueve nada que ya tenga hilo ni le da a
nadie un mensaje que no recibió: sirven para reparar los mensajes que el
código anterior haya escrito sin hilo durante el deploy (ver el historial
2026-11-11-chat-por-asignacion). Fuera de ese caso no hace falta correrlas.

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

# Comienzo del texto de un mensaje tal como quedó en su aviso
# (`ChatService._notify_recipient`: hasta 80 caracteres enteros; si no, 77 y
# `...`). Fue 80 desde que existe el chat.
_LARGO_DEL_AVISO = 80


def _comienzo(cuerpo: str) -> str:
    return (
        f"CASE WHEN LENGTH({cuerpo}) <= {_LARGO_DEL_AVISO} THEN {cuerpo} "
        f"ELSE SUBSTR({cuerpo}, 1, {_LARGO_DEL_AVISO - 3}) || '...' END"
    )


# Avisos de chat que coinciden con el mensaje: los del turno (por el link),
# dirigidos a alguien que no es el comercio, con el comienzo de su texto.
_AVISOS_DEL_MENSAJE = f"""
      FROM notifications n
     WHERE n.type = 'chat_message'
       AND n.link = '/chats/' || CAST(chat_messages.shift_id AS TEXT)
       AND n.user_id <> chat_messages.sender_user_id
       AND n.message = {_comienzo("chat_messages.body")}
"""

# Regla 2: lo que escribió el comercio va al hilo del destinatario de su aviso.
_RELLENO_DEL_COMERCIO = f"""
UPDATE chat_messages
   SET worker_user_id = (SELECT n.user_id {_AVISOS_DEL_MENSAJE} LIMIT 1)
 WHERE worker_user_id IS NULL
   AND sender_user_id = ({_COMERCIO_DEL_TURNO})
   AND NOT EXISTS (
       SELECT 1
         FROM chat_messages otro
        WHERE otro.shift_id = chat_messages.shift_id
          AND otro.sender_user_id = chat_messages.sender_user_id
          AND otro.id <> chat_messages.id
          AND {_comienzo("otro.body")} = {_comienzo("chat_messages.body")}
   )
   AND (SELECT COUNT(*) {_AVISOS_DEL_MENSAJE}) = 1
   AND EXISTS (
       SELECT 1
         FROM worker_profiles wp
        WHERE wp.user_id = (SELECT n.user_id {_AVISOS_DEL_MENSAJE} LIMIT 1)
   )
"""

# Independientes entre sí: ninguna lee la columna nueva salvo para no tocar lo
# que ya tiene hilo.
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
