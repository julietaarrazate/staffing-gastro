"""Gestor en memoria de conexiones WebSocket activas.

Permite push en tiempo real (chat y notificaciones) sin depender de un broker
externo. Si el proceso corre con más de un worker o instancia, cada uno sólo
ve sus propias conexiones; un pub/sub (Redis) es el paso natural si se
escala horizontalmente, pero hoy correr un solo worker lo hace innecesario.
"""

import asyncio
from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket, status

# PRODUCTION_HARDENING.md (TECH_DEBT S2): antes sin ningún tope, un cliente
# podía abrir conexiones sin límite. 8 alcanza para varias pestañas/
# dispositivos del mismo turno o usuario sin habilitar un flood real.
MAX_CONNECTIONS_PER_KEY = 8


class ConnectionManager:
    def __init__(self) -> None:
        # Por turno, cada conexión con el hilo sobre el que se abrió: el
        # `user_id` del trabajador que estaba asignado al conectarse. El chat
        # es del comercio con UNA persona asignada; si el turno se reasigna,
        # las conexiones que quedaron abiertas son de otro hilo.
        self._chat: dict[UUID, dict[WebSocket, UUID]] = defaultdict(dict)
        self._notifications: dict[UUID, set[WebSocket]] = defaultdict(set)
        # Cierres en curso de conexiones de un hilo anterior (ver
        # `_close_stale_chat`): la referencia evita que la tarea se pierda.
        self._closing: set[asyncio.Task[None]] = set()

    def connect_chat(
        self, shift_id: UUID, worker_user_id: UUID, websocket: WebSocket
    ) -> bool:
        """Registra la conexión sobre el hilo del turno con `worker_user_id`.

        Devuelve `False` (y no registra la conexión) si ya se alcanzó el
        tope para este hilo — el caller debe cerrar el WebSocket. El tope es
        por hilo, no por turno: las conexiones que quedaron abiertas sobre un
        hilo anterior (hasta que el próximo envío las corte) no le quitan
        lugar a quien tiene el turno ahora."""
        on_thread = sum(
            1 for thread in self._chat[shift_id].values() if thread == worker_user_id
        )
        if on_thread >= MAX_CONNECTIONS_PER_KEY:
            return False
        self._chat[shift_id][websocket] = worker_user_id
        return True

    def disconnect_chat(self, shift_id: UUID, websocket: WebSocket) -> None:
        self._chat[shift_id].pop(websocket, None)
        if not self._chat[shift_id]:
            del self._chat[shift_id]

    async def broadcast_chat(
        self, shift_id: UUID, worker_user_id: UUID, payload: dict
    ) -> None:
        """Entrega `payload` a las conexiones abiertas sobre ESE hilo.

        Una conexión del mismo turno abierta sobre otro hilo quedó de antes de
        una reasignación: no recibe nada y se corta. Si era de quien ya no
        está asignado, no puede volver a conectarse; si era del comercio, su
        cliente reconecta solo y queda sobre el hilo vigente."""
        for ws, thread_worker_user_id in list(self._chat.get(shift_id, {}).items()):
            if thread_worker_user_id != worker_user_id:
                self._close_stale_chat(shift_id, ws)
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect_chat(shift_id, ws)

    def _close_stale_chat(self, shift_id: UUID, websocket: WebSocket) -> None:
        """Saca la conexión del registro ya mismo y la cierra en segundo plano.

        No se espera el cierre: con un cliente que dejó de responder, el
        saludo de cierre del WebSocket puede tardar varios segundos, y esto
        corre dentro del envío de un mensaje de otra persona."""
        self.disconnect_chat(shift_id, websocket)
        task = asyncio.create_task(_close_quietly(websocket))
        self._closing.add(task)
        task.add_done_callback(self._closing.discard)

    def connect_notification(self, user_id: UUID, websocket: WebSocket) -> bool:
        """Mismo criterio que `connect_chat`, con el usuario como clave."""
        if len(self._notifications[user_id]) >= MAX_CONNECTIONS_PER_KEY:
            return False
        self._notifications[user_id].add(websocket)
        return True

    def disconnect_notification(self, user_id: UUID, websocket: WebSocket) -> None:
        self._notifications[user_id].discard(websocket)
        if not self._notifications[user_id]:
            del self._notifications[user_id]

    async def broadcast_notification(self, user_id: UUID, payload: dict) -> None:
        for ws in list(self._notifications.get(user_id, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect_notification(user_id, ws)


async def _close_quietly(websocket: WebSocket) -> None:
    try:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception:
        # Ya estaba cerrada o caída: alcanza con haberla sacado del registro.
        pass


ws_manager = ConnectionManager()
