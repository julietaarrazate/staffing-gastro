"""Observabilidad (R1.1): request_id por request, logging estructurado y Sentry.

Tres piezas chicas, sin infraestructura externa:

- `RequestIdMiddleware`: asigna un `request_id` único por request (o respeta el
  header `X-Request-ID` entrante), lo expone en la respuesta y en un
  `ContextVar` para que cualquier log emitido durante la request lo incluya.
- `setup_logging()`: formato JSON (con `LOG_JSON=true`, pensado para Render)
  o texto legible en desarrollo; siempre con el `request_id` correlacionado.
- `setup_sentry()`: inicializa Sentry SOLO si `SENTRY_DSN` está configurado.
  Sin DSN es un no-op: el código puede mergearse antes de tener la cuenta.
"""

import json
import logging
import sys
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Correlaciona cada request con un id único (header X-Request-ID)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response


# Atributos estándar de `LogRecord` (stdlib): lo que NO está en este set y
# se haya pasado vía `logger.info(msg, extra={...})` se interpreta como
# datos propios del evento (ver `_JsonFormatter`). Lista fija de la propia
# documentación de `logging` — no cambia entre versiones de Python 3.
_STANDARD_LOG_RECORD_ATTRS = frozenset(
    {
        "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
        "created", "msecs", "relativeCreated", "thread", "threadName",
        "processName", "process", "message", "asctime", "taskName",
    }
)


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Eventos de negocio (`logger.info("shift.published", extra={...})`,
        # ver docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md §5): los
        # campos de `extra` viajan bajo "data" en vez de perderse — sin esto,
        # el JSON estructurado sólo tenía el mensaje como texto libre, no
        # campos filtrables. No afecta ningún log existente sin `extra`.
        extra = {
            k: v
            for k, v in record.__dict__.items()
            if k not in _STANDARD_LOG_RECORD_ATTRS and not k.startswith("_")
        }
        if extra:
            payload["data"] = extra
        return json.dumps(payload, ensure_ascii=False, default=str)


class _PlainFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        record.request_id = request_id_var.get()
        return super().format(record)


def setup_logging() -> None:
    """Configura el root logger una sola vez (idempotente)."""
    root = logging.getLogger()
    if getattr(root, "_staffya_configured", False):
        return
    handler = logging.StreamHandler(sys.stdout)
    if settings.log_json:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            _PlainFormatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")
        )
    root.handlers = [handler]
    root.setLevel(logging.DEBUG if settings.debug else logging.INFO)
    root._staffya_configured = True  # type: ignore[attr-defined]


def setup_sentry() -> None:
    """Activa Sentry si hay DSN configurado; si no, no hace nada.

    Corre a nivel de módulo, antes de levantar el servidor: un `SENTRY_DSN`
    mal cargado (espacio de más, formato inválido) no debe poder tirar abajo
    el arranque de TODA la API — Sentry es observabilidad, no un requisito
    para servir tráfico. Cualquier falla acá se degrada a "Sentry off" con un
    log, nunca un crash del proceso."""
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            # Sin tracing de performance por ahora: sólo captura de errores.
            traces_sample_rate=0.0,
            send_default_pii=False,
        )
    except Exception:
        logging.getLogger(__name__).exception(
            "No se pudo inicializar Sentry (SENTRY_DSN mal configurado); "
            "arrancando sin Sentry."
        )
