"""Tests del formatter JSON de logging (app/core/observability.py).

Unitarios, sin DB: `_JsonFormatter` no depende de nada async ni de sesión.
"""

import json
import logging

from app.core.observability import (
    SENTRY_FAILED_STATUS_CODES,
    _JsonFormatter,
    request_id_var,
    scrub_sentry_event,
)


def _make_record(
    msg: str, *, extra: dict | None = None, level: int = logging.INFO
) -> logging.LogRecord:
    record = logging.LogRecord(
        name="test.logger",
        level=level,
        pathname=__file__,
        lineno=1,
        msg=msg,
        args=(),
        exc_info=None,
    )
    for key, value in (extra or {}).items():
        setattr(record, key, value)
    return record


def test_json_formatter_includes_core_fields():
    record = _make_record("shift.published")
    payload = json.loads(_JsonFormatter().format(record))
    assert payload["message"] == "shift.published"
    assert payload["level"] == "INFO"
    assert payload["logger"] == "test.logger"
    assert "ts" in payload
    assert "data" not in payload  # sin extra, no hay clave "data"


def test_json_formatter_merges_extra_under_data():
    """Los campos de `extra=` de un business event (shift_id, company_id,
    etc.) viajan bajo "data" en el JSON — antes de este cambio se
    descartaban silenciosamente (ver docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md §5)."""
    record = _make_record(
        "shift.published", extra={"shift_id": "abc-123", "company_id": "def-456"}
    )
    payload = json.loads(_JsonFormatter().format(record))
    assert payload["data"] == {"shift_id": "abc-123", "company_id": "def-456"}


def test_json_formatter_includes_request_id_from_contextvar():
    token = request_id_var.set("req-xyz")
    try:
        payload = json.loads(_JsonFormatter().format(_make_record("evt")))
        assert payload["request_id"] == "req-xyz"
    finally:
        request_id_var.reset(token)


def test_json_formatter_serializes_non_json_native_extra_values():
    """Un valor no serializable directamente (UUID) no debe romper el log —
    `default=str` en `json.dumps` lo convierte a texto en vez de lanzar."""
    from uuid import uuid4

    shift_id = uuid4()
    record = _make_record("shift.published", extra={"shift_id": shift_id})
    payload = json.loads(_JsonFormatter().format(record))
    assert payload["data"]["shift_id"] == str(shift_id)


def test_json_formatter_does_not_leak_standard_record_attrs_into_data():
    """Atributos estándar de `LogRecord` (module, funcName, etc., seteados
    automáticamente por el logger real, no por `extra=`) no deben aparecer
    en "data" — sólo lo que un caller pasó explícitamente."""
    logger = logging.getLogger("test.real.logger")
    record = logger.makeRecord(
        logger.name, logging.INFO, __file__, 1, "shift.published", (), None
    )
    payload = json.loads(_JsonFormatter().format(record))
    assert "data" not in payload


# --- before_send de Sentry (revisión de seguridad 2026-10-20) ---------------


def test_scrub_tapa_la_clave_en_la_url_de_un_error():
    """STAFFYA-BACKEND-7: la clave de Gemini llegó entera en el mensaje de
    `HTTPStatusError` (`...:generateContent?key=AQ...`)."""
    msg = (
        "Server error '503' for url 'https://generativelanguage.googleapis.com"
        "/v1beta/models/x:generateContent?key=SECRETO123&alt=json'"
    )
    event = {
        "exception": {"values": [{"type": "HTTPStatusError", "value": msg}]},
        "logentry": {"message": msg},
    }
    out = scrub_sentry_event(event, {})
    assert "SECRETO123" not in str(out)
    assert "?key=[Filtered]&alt=json" in out["exception"]["values"][0]["value"]


def test_scrub_tapa_campos_sensibles_del_cuerpo_y_bearer():
    event = {
        "request": {
            "data": {"email": "a@b.com", "new_password": "x", "pin": "1234"},
            "headers": {"Authorization": "Bearer abc.def", "Accept": "json"},
        },
        "extra": {"nota": "token Bearer eyJhbGci.xyz en el texto"},
    }
    out = scrub_sentry_event(event, {})
    assert out["request"]["data"] == {
        "email": "a@b.com",
        "new_password": "[Filtered]",
        "pin": "[Filtered]",
    }
    assert out["request"]["headers"]["Authorization"] == "[Filtered]"
    assert out["request"]["headers"]["Accept"] == "json"
    assert "eyJhbGci" not in out["extra"]["nota"]
def test_uvicorn_logs_hide_the_websocket_token():
    """Revisión de seguridad 2026-10-20: el handshake del WebSocket lleva el
    access token en `?token=` y uvicorn loguea el path completo."""
    from app.core.observability import _RedactTokenFilter

    record = logging.LogRecord(
        "uvicorn.error",
        logging.INFO,
        __file__,
        1,
        '%s - "WebSocket %s" [accepted]',
        ("1.2.3.4:5", "/api/v1/notifications/ws?token=eyJhbGci.abc.def&x=1"),
        None,
    )
    assert _RedactTokenFilter().filter(record)
    text = record.getMessage()
    assert "eyJhbGci" not in text
    assert "?token=[Filtered]&x=1" in text


def test_scrub_tapa_el_token_al_principio_del_query_string():
    """El SDK de Sentry guarda `request.query_string` sin el `?` adelante:
    `token=…` al principio también se tiene que tapar."""
    event = {"request": {"query_string": "token=eyJsecreto&x=1"}}
    scrubbed = scrub_sentry_event(event, None)
    assert scrubbed["request"]["query_string"] == "token=[Filtered]&x=1"


def test_sentry_no_reporta_las_caidas_de_servicios_de_afuera():
    """502/503 son respuestas a propósito cuando Gemini u OpenStreetMap no
    responden; un 500 es un bug y se reporta."""
    assert 502 not in SENTRY_FAILED_STATUS_CODES
    assert 503 not in SENTRY_FAILED_STATUS_CODES
    assert 500 in SENTRY_FAILED_STATUS_CODES
    assert 504 in SENTRY_FAILED_STATUS_CODES
