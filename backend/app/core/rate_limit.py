"""Rate limiting simple en memoria.

Pensado para proteger endpoints sensibles (login/registro) de fuerza bruta sin
introducir infraestructura externa. Es **por proceso**: con un solo worker (el
deploy actual) alcanza; escalar horizontalmente requeriría un store compartido
(Redis) y un ADR. Ver docs/reference/SECURITY.md.
"""

import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# Registro de todos los limitadores creados, para poder resetearlos en tests.
_registry: list["RateLimiter"] = []


class RateLimiter:
    """Ventana fija por IP. Usar como dependencia de FastAPI (`Depends`)."""

    def __init__(self, *, max_attempts: int, window_seconds: int, name: str) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.name = name
        self._hits: dict[str, list[float]] = defaultdict(list)
        _registry.append(self)

    def check(self, key: str) -> None:
        """Cuenta un intento contra `key` (IP, user id, lo que corresponda) y
        tira 429 si superó el límite. Separado de `__call__` para poder
        usarse en endpoints autenticados con una clave que no sea la IP
        (ver `chat/api/routes.py`, PRODUCTION_HARDENING.md)."""
        if not settings.rate_limit_enabled:
            return
        now = time.monotonic()
        recent = [t for t in self._hits[key] if now - t < self.window_seconds]
        if len(recent) >= self.max_attempts:
            # PRODUCTION_HARDENING.md: un solo punto de log para los 429 de
            # todos los limitadores (login/register/refresh/chat/etc.) — la
            # `key` ya es IP o user_id según el limitador, nunca un dato
            # sensible en sí misma.
            logger.warning("429 rate limit '%s' key=%s", self.name, key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Esperá un momento y volvé a probar.",
            )
        recent.append(now)
        self._hits[key] = recent

    async def __call__(self, request: Request) -> None:
        client = request.client
        ip = client.host if client else "unknown"
        self.check(ip)

    def reset(self) -> None:
        self._hits.clear()


def reset_all_rate_limiters() -> None:
    """Limpia el estado de todos los limitadores (uso en tests)."""
    for limiter in _registry:
        limiter.reset()
