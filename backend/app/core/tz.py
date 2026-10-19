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
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

ARG_TZ = ZoneInfo("America/Argentina/Buenos_Aires")

_DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


def to_art(value: datetime) -> datetime:
    """Pasa un instante a hora argentina. Un datetime sin zona se toma como
    UTC, que es como lo guarda la base (SQLite en los tests lo devuelve sin
    zona)."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ARG_TZ)


def format_turno_art(start_at: datetime, end_at: datetime) -> str:
    """Horario de un turno para que lo lea una persona: "sábado 27/09, de
    20:00 a 02:00", siempre en hora argentina.

    Existe porque el mail de "te aceptaron" hacía `start_at.strftime(...)`
    sobre el datetime de la base, que está en UTC: un turno de las 20:00
    llegaba como "a las 23:00". Toda hora que vea un usuario pasa por acá
    o por `to_art`, nunca por un `strftime` directo."""
    inicio = to_art(start_at)
    fin = to_art(end_at)
    return f"{_DIAS[inicio.weekday()]} {inicio:%d/%m}, de {inicio:%H:%M} a {fin:%H:%M}"


def now_art() -> datetime:
    """Fecha y hora actual en Argentina (timezone-aware)."""
    return datetime.now(ARG_TZ)


def hoy_art() -> date:
    """Fecha de hoy en Argentina (no UTC). Usar como default de fechas de
    negocio (ej. cálculo de edad, "turnos de hoy", cortes de período)."""
    return datetime.now(ARG_TZ).date()
