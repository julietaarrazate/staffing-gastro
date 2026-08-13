"""Tests del formatter JSON de logging (app/core/observability.py).

Unitarios, sin DB: `_JsonFormatter` no depende de nada async ni de sesión.
"""

import json
import logging

from app.core.observability import _JsonFormatter, request_id_var


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
