"""Utilidades de fecha/hora en horario de Argentina (ART, UTC-3).

El servidor corre en UTC (Render). `date.today()` y `datetime.now()` (sin tz)
devuelven la fecha/hora UTC, lo que entre la medianoche y las 3 AM hora
argentina da la fecha de MAÑANA (o de HOY cuando en Argentina todavía es
AYER, según el cálculo) — el bug no aparece en testing diurno, sólo en esa
ventana. Mismo patrón que `conciliacion-bancaria/backend/app/services/tz.py`
(ver `docs/BUGS.md`).

Para toda fecha de NEGOCIO (edad calculada desde `birth_date`, "turnos de
hoy", períodos de facturación/renovación con corte de día, vencimientos)
hay que usar estos helpers para reflejar el día real en Argentina.

Las marcas de tiempo internas/auditoría (`created_at`/`updated_at` vía
`func.now()`, `revoked_at`, `used_at`, `check_in_at`/`check_out_at`/
`no_show_at`/`paid_at`, expiración de tokens de refresh/reset) siguen en
UTC a propósito — eso es correcto y consistente, NO usar `hoy_art()`/
`now_art()` ahí.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

ARG_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def now_art() -> datetime:
    """Fecha y hora actual en Argentina (timezone-aware)."""
    return datetime.now(ARG_TZ)


def hoy_art() -> date:
    """Fecha de hoy en Argentina (no UTC). Usar como default de fechas de
    negocio (ej. cálculo de edad, "turnos de hoy", cortes de período)."""
    return datetime.now(ARG_TZ).date()
