"""Vigencia de una conexión WebSocket (PRI-04).

Un WebSocket autoriza una sola vez, en el handshake. Sin esto, una conexión
abierta seguía entregando lo de la cuenta después de que venciera el access
token de quien la abrió. El socket espera frames del cliente sólo hasta ese
vencimiento y después se corta (1008): el cliente reconecta con el token
renovado (`frontend/lib/useWebSocket.ts`)."""

import asyncio
import time

from fastapi import WebSocket


async def receive_text_until(websocket: WebSocket, expires_at: float | None) -> str | None:
    """Espera el próximo frame de texto del cliente. Devuelve `None` si el
    token venció antes (el caller cierra la conexión). Sin vencimiento
    conocido espera sin tope. Si el cliente se va, tira `WebSocketDisconnect`
    como `receive_text`."""
    if expires_at is None:
        return await websocket.receive_text()
    remaining = expires_at - time.time()
    if remaining <= 0:
        return None
    try:
        return await asyncio.wait_for(websocket.receive_text(), timeout=remaining)
    except asyncio.TimeoutError:
        return None
