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
from datetime import date, datetime, timedelta, timezone
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


def format_inicio_art(start_at: datetime, now: datetime | None = None) -> str:
    """Cuándo empieza un turno, para una frase: "hoy a las 20:00", "mañana a las
    20:00" o "el sábado 27/09 a las 20:00", siempre en hora argentina."""
    inicio = to_art(start_at)
    hoy = to_art(now if now is not None else datetime.now(timezone.utc)).date()
    if inicio.date() == hoy:
        return f"hoy a las {inicio:%H:%M}"
    if inicio.date() == hoy + timedelta(days=1):
        return f"mañana a las {inicio:%H:%M}"
    return f"el {_DIAS[inicio.weekday()]} {inicio:%d/%m} a las {inicio:%H:%M}"


def format_duracion(value: timedelta) -> str:
    """Una duración en palabras: "2 horas", "45 minutos", "1 hora y 30
    minutos", "1 día". Redondea hacia arriba al minuto (nadie lee segundos en
    un aviso de "todavía falta") y nunca devuelve algo como "PT2H" ni
    "2:00:00"."""
    minutos = max(0, -(-int(value.total_seconds()) // 60))
    if minutos == 0:
        return "menos de un minuto"
    dias, resto = divmod(minutos, 24 * 60)
    horas, mins = divmod(resto, 60)
    partes = []
    if dias:
        partes.append(f"{dias} día" + ("s" if dias != 1 else ""))
    if horas:
        partes.append(f"{horas} hora" + ("s" if horas != 1 else ""))
    if mins:
        partes.append(f"{mins} minuto" + ("s" if mins != 1 else ""))
    if len(partes) == 1:
        return partes[0]
    return ", ".join(partes[:-1]) + " y " + partes[-1]


def format_desde_art(momento: datetime, now: datetime | None = None) -> str:
    """Desde cuándo se habilita algo, para una frase, en hora argentina:
    "desde las 13:20 de hoy", "desde las 13:20 de mañana", "desde las 13:20
    del viernes" (dentro de la semana) o "desde las 13:20 del viernes 27/11"
    (más lejos, para que "viernes" no sea ambiguo)."""
    cuando = to_art(momento)
    hoy = to_art(now if now is not None else datetime.now(timezone.utc)).date()
    dias = (cuando.date() - hoy).days
    hora = f"{cuando:%H:%M}"
    if dias == 0:
        return f"desde las {hora} de hoy"
    if dias == 1:
        return f"desde las {hora} de mañana"
    dia = _DIAS[cuando.weekday()]
    if 1 < dias < 7:
        return f"desde las {hora} del {dia}"
    return f"desde las {hora} del {dia} {cuando:%d/%m}"


def now_art() -> datetime:
    """Fecha y hora actual en Argentina (timezone-aware)."""
    return datetime.now(ARG_TZ)


def hoy_art() -> date:
    """Fecha de hoy en Argentina (no UTC). Usar como default de fechas de
    negocio (ej. cálculo de edad, "turnos de hoy", cortes de período)."""
    return datetime.now(ARG_TZ).date()
