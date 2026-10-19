"""Backend detrás de Cloudflare: sólo se entra por ahí, y con la IP real.

Render no deja limitar quién se conecta a un servicio web, así que el corte
se hace acá: Cloudflare agrega a cada pedido que pasa por api.oido.com.ar el
header `X-Oido-Edge` con un secreto (`EDGE_SHARED_SECRET`). Sin ese header
(alguien que le pega directo a staffya-backend.onrender.com) la respuesta es
403, salvo `/health`, que usa el chequeo de Render.

Con el secreto validado también se puede confiar en la IP real de quien hace
el pedido: `X-Oido-Client-IP`, que la misma regla de Cloudflare llena con
`ip.src` (header propio porque Render también tiene Cloudflare adelante y
`CF-Connecting-IP` podría llegar pisado), o si no `CF-Connecting-IP`. Sin esto todos los pedidos llegaban con la IP
del proxy de Render y el límite de intentos era uno solo para todo el mundo
(auditoría 2026-10-10 y 2026-10-14).

Secreto vacío = todo apagado, igual que antes.
"""

import hmac

from starlette.requests import HTTPConnection
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings

EDGE_HEADER = "x-oido-edge"
CLIENT_IP_HEADER = "x-oido-client-ip"
_OPEN_PATHS = frozenset({"/health"})


def _edge_ok(headers) -> bool:
    secret = settings.edge_shared_secret
    if not secret:
        return False
    sent = headers.get(EDGE_HEADER, "")
    return hmac.compare_digest(sent.encode(), secret.encode())


def client_ip(conn: HTTPConnection) -> str:
    """IP de quien hace el pedido: la que manda Cloudflare si el pedido
    probadamente pasó por Cloudflare; si no, la de la conexión."""
    if _edge_ok(conn.headers):
        real = (
            conn.headers.get(CLIENT_IP_HEADER, "") or conn.headers.get("cf-connecting-ip", "")
        ).strip()
        if real:
            return real
    client = conn.client
    return client.host if client else "unknown"


class EdgeGuardMiddleware:
    """Corta lo que no viene por Cloudflare. ASGI puro para cubrir también
    los WebSockets (chat y notificaciones), que `BaseHTTPMiddleware` no ve."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] not in ("http", "websocket")
            or not settings.edge_shared_secret
            or scope.get("path") in _OPEN_PATHS
            or _edge_ok(HTTPConnection(scope).headers)
        ):
            await self.app(scope, receive, send)
            return

        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        body = b'{"detail":"Forbidden"}'
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
