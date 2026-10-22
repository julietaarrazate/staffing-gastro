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
from app.core.edge import client_ip

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
        if self.is_exceeded(key):
            self.reject(key)
        self.record(key)

    def _recent(self, key: str) -> list[float]:
        now = time.monotonic()
        recent = [t for t in self._hits.get(key, []) if now - t < self.window_seconds]
        if recent:
            self._hits[key] = recent
        else:
            self._hits.pop(key, None)
        return recent

    def is_exceeded(self, key: str) -> bool:
        """Consulta sin sumar: ¿`key` ya llegó al límite en la ventana?
        Para limitadores que cuentan solo algunos intentos (los fallidos del
        login por email, ver `identity/api/routes.py`)."""
        if not settings.rate_limit_enabled:
            return False
        return len(self._recent(key)) >= self.max_attempts

    def record(self, key: str) -> None:
        """Suma un intento contra `key` sin chequear el límite."""
        if not settings.rate_limit_enabled:
            return
        self._hits[key] = [*self._recent(key), time.monotonic()]

    def reject(self, key: str) -> None:
        """Tira el 429. PRODUCTION_HARDENING.md: un solo punto de log para
        los 429 de todos los limitadores (login/register/refresh/chat/etc.)
        — la `key` es IP, user_id o un hash, nunca un dato sensible en sí
        misma."""
        logger.warning("429 rate limit '%s' key=%s", self.name, key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Esperá un momento y volvé a probar.",
        )

    async def __call__(self, request: Request) -> None:
        self.check(client_ip(request))

    def reset(self) -> None:
        self._hits.clear()


def reset_all_rate_limiters() -> None:
    """Limpia el estado de todos los limitadores (uso en tests)."""
    for limiter in _registry:
        limiter.reset()
