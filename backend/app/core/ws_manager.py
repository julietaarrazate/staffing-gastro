"""Gestor en memoria de conexiones WebSocket activas.

Permite push en tiempo real (chat y notificaciones) sin depender de un broker
externo. Si el proceso corre con más de un worker o instancia, cada uno sólo
ve sus propias conexiones; un pub/sub (Redis) es el paso natural si se
escala horizontalmente, pero hoy correr un solo worker lo hace innecesario.
"""

from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket

# PRODUCTION_HARDENING.md (TECH_DEBT S2): antes sin ningún tope, un cliente
# podía abrir conexiones sin límite. 8 alcanza para varias pestañas/
# dispositivos del mismo turno o usuario sin habilitar un flood real.
MAX_CONNECTIONS_PER_KEY = 8


class ConnectionManager:
    def __init__(self) -> None:
        self._chat: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._notifications: dict[UUID, set[WebSocket]] = defaultdict(set)

    def connect_chat(self, shift_id: UUID, websocket: WebSocket) -> bool:
        """Devuelve `False` (y no registra la conexión) si ya se alcanzó el
        tope para este turno — el caller debe cerrar el WebSocket."""
        if len(self._chat[shift_id]) >= MAX_CONNECTIONS_PER_KEY:
            return False
        self._chat[shift_id].add(websocket)
        return True

    def disconnect_chat(self, shift_id: UUID, websocket: WebSocket) -> None:
        self._chat[shift_id].discard(websocket)
        if not self._chat[shift_id]:
            del self._chat[shift_id]

    async def broadcast_chat(self, shift_id: UUID, payload: dict) -> None:
        for ws in list(self._chat.get(shift_id, ())):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect_chat(shift_id, ws)

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


ws_manager = ConnectionManager()
