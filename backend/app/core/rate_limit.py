"""Rate limiting simple en memoria.

Pensado para proteger endpoints sensibles (login/registro) de fuerza bruta sin
introducir infraestructura externa. Es **por proceso**: con un solo worker (el
deploy actual) alcanza; escalar horizontalmente requeriría un store compartido
(Redis) y un ADR. Ver docs/reference/SECURITY.md.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import settings

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

    async def __call__(self, request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        client = request.client
        ip = client.host if client else "unknown"
        now = time.monotonic()
        recent = [t for t in self._hits[ip] if now - t < self.window_seconds]
        if len(recent) >= self.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Esperá un momento y volvé a probar.",
            )
        recent.append(now)
        self._hits[ip] = recent

    def reset(self) -> None:
        self._hits.clear()


def reset_all_rate_limiters() -> None:
    """Limpia el estado de todos los limitadores (uso en tests)."""
    for limiter in _registry:
        limiter.reset()
