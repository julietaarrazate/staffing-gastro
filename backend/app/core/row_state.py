"""Guardar sólo lo que el caso de uso cambió, o sólo si nadie cambió la fila.

Los repositorios leen una fila, el caso de uso cambia la entidad y el
repositorio la guarda. Si guardaba la entidad entera, pisaba lo que otro
pedido escribió en el medio (pasada del 2026-11-19: ESC-01, CON-08, CON-13).
Para no pisarlo, la entidad lleva cómo estaba la fila cuando se leyó
(`persisted_state`, un dict columna → valor que arma el repositorio) y el
repositorio elige una de dos:

- `changed_since_read`: escribe sólo las columnas que el caso de uso cambió
  (el usuario: cambiarse el nombre no toca la suspensión).
- `unchanged_since_read`: escribe sólo si la fila sigue como se leyó
  (`UPDATE … WHERE <columna> = <leído>`, la suscripción y el pedido de
  verificación); si afectó 0 filas, perdió la carrera. Es un bloqueo
  optimista como el del turno (ADR-0016), sin columna de versión.
"""

from collections.abc import Mapping
from typing import Any

from sqlalchemy import ColumnElement


def changed_since_read(
    persisted: Mapping[str, Any] | None, current: Mapping[str, Any]
) -> dict[str, Any]:
    """Las columnas de `current` cuyo valor cambió desde la lectura. Sin
    lectura (`None`), todas."""
    if persisted is None:
        return dict(current)
    return {
        column: value
        for column, value in current.items()
        if column not in persisted or persisted[column] != value
    }


def unchanged_since_read(
    model: type, persisted: Mapping[str, Any]
) -> list[ColumnElement[bool]]:
    """Condiciones «cada columna sigue con el valor que se leyó», para el
    WHERE de un UPDATE (un `None` leído pide que siga en NULL)."""
    conditions: list[ColumnElement[bool]] = []
    for column, value in persisted.items():
        attribute = getattr(model, column)
        conditions.append(attribute.is_(None) if value is None else attribute == value)
    return conditions
