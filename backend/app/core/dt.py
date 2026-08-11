"""Utilidad de comparación de datetimes entre dialectos de base de datos.

En SQLite (tests) los datetimes vuelven sin `tzinfo`; en Postgres las
columnas `TIMESTAMPTZ` sí lo preservan. `naive()` normaliza a "naive" antes
de comparar — se asume que ambos valores están en UTC. Antes vivía
duplicada (idéntica, cinco veces) en `identity/domain/entities.py`,
`subscription/domain/entities.py`, `shift/application/services.py`,
`shift/application/scheduler.py` y `admin/application/services.py`
(CLEANUP_REPORT.md).
"""

from datetime import datetime


def naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


def parse_iso_datetime(value: str | None) -> datetime | None:
    """Gemini puede devolver un horario mal formado (o directamente texto en
    vez de ISO-8601) pese al `responseSchema` — se descarta ese campo en vez
    de romper el endpoint entero; el usuario lo completa a mano. Antes vivía
    como `_safe_datetime`, sólo en `shift/api/routes.py`."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
