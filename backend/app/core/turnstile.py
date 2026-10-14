"""Cloudflare Turnstile: comprobar que quien se registra o entra no es un robot.

El frontend muestra el widget de Turnstile y manda el token que devuelve en el
header `X-Turnstile-Token`. Acá se valida contra Cloudflare (`siteverify`). El
token lo decide Cloudflare, no el navegador: un robot que salte el widget no
tiene un token válido.

Un token sirve una sola vez para Cloudflare. El registro hace dos pedidos
seguidos con el mismo (`/auth/register` y enseguida `/auth/login`), así que
un token ya validado se acepta UNA vez más, desde la misma IP y dentro de
2 minutos. Nada más.

`TURNSTILE_SECRET_KEY` vacía = no se pide (como hoy, y en tests y local).
"""

import logging
import time

import httpx
from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.edge import client_ip

logger = logging.getLogger(__name__)

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TOKEN_HEADER = "X-Turnstile-Token"
_REUSE_WINDOW_S = 120

# token → (ip, vence, usos restantes)
_verified: dict[str, tuple[str, float, int]] = {}


async def _siteverify(token: str, ip: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                SITEVERIFY_URL,
                data={
                    "secret": settings.turnstile_secret_key,
                    "response": token,
                    "remoteip": ip,
                },
            )
        return bool(res.json().get("success"))
    except Exception:  # noqa: BLE001 — Cloudflare caído: se rechaza, no se deja pasar
        logger.exception("turnstile: no se pudo validar el token")
        return False


def _reuse(token: str, ip: str, now: float) -> bool:
    entry = _verified.get(token)
    if entry is None:
        return False
    seen_ip, expires, left = entry
    if seen_ip != ip or now > expires or left <= 0:
        _verified.pop(token, None)
        return False
    _verified[token] = (seen_ip, expires, left - 1)
    return True


async def require_turnstile(request: Request) -> None:
    """Dependencia de FastAPI para login y registro."""
    if not settings.turnstile_secret_key:
        return
    token = request.headers.get(TOKEN_HEADER, "").strip()
    ip = client_ip(request)
    now = time.monotonic()
    for key in [k for k, (_, exp, _) in _verified.items() if now > exp]:
        _verified.pop(key, None)

    if token and (_reuse(token, ip, now) or await _siteverify(token, ip)):
        _verified.setdefault(token, (ip, now + _REUSE_WINDOW_S, 1))
        return
    logger.warning("turnstile: token ausente o inválido ip=%s", ip)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No pudimos comprobar que no seas un robot. Recargá la página y probá de nuevo.",
    )


def reset() -> None:
    """Para tests."""
    _verified.clear()
