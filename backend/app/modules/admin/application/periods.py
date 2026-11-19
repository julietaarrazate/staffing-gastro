"""Ventanas de tiempo del panel de admin, en días de Argentina.

"Hoy" y "los últimos 7 días" son fechas de negocio: se cortan a la
medianoche argentina (`app/core/tz.py`), no a la de UTC. Entre las 21:00 y
la medianoche de Argentina ya es "mañana" en UTC, y un corte en UTC contaría
la noche de hoy como de mañana. Las funciones devuelven instantes en UTC,
que es como la base guarda las marcas de tiempo.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from app.core.tz import ARG_TZ, to_art

# Períodos que ofrece "Métricas" (pedido de Julieta, 2026-10-20).
METRICS_PERIODS: tuple[int, ...] = (7, 30)

# Serie semanal M7 (docs/planning/BETA_TABLERO.md): cuántas semanas se
# pueden pedir. Un año alcanza para la lámina de tracción y mantiene acotada
# la consulta (una columna por semana y por indicador).
MAX_WEEKS = 52


@dataclass(frozen=True)
class PeriodBounds:
    """Período actual `[current_start, end)` y el anterior, del mismo largo,
    `[previous_start, current_start)`. El actual termina al final de hoy
    (hora argentina): "los últimos 7 días" incluye hoy."""

    days: int
    previous_start: datetime
    current_start: datetime
    end: datetime


def _midnight_utc(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=ARG_TZ).astimezone(UTC)


def day_bounds(now: datetime) -> tuple[datetime, datetime]:
    """Comienzo y fin (exclusivo) del día argentino de `now`, en UTC."""
    today = to_art(now).date()
    return _midnight_utc(today), _midnight_utc(today + timedelta(days=1))


def period_bounds(days: int, now: datetime) -> PeriodBounds:
    """Los últimos `days` días argentinos (hoy incluido) y los `days`
    anteriores."""
    if days < 1:
        raise ValueError("El período tiene que tener al menos un día")
    today = to_art(now).date()
    end_day = today + timedelta(days=1)
    current_day = end_day - timedelta(days=days)
    previous_day = current_day - timedelta(days=days)
    return PeriodBounds(
        days=days,
        previous_start=_midnight_utc(previous_day),
        current_start=_midnight_utc(current_day),
        end=_midnight_utc(end_day),
    )


def week_bounds(weeks: int, now: datetime) -> list[tuple[datetime, datetime]]:
    """Las últimas `weeks` semanas argentinas, de lunes a domingo, de la más
    vieja a la de hoy (que va incluida, en curso). Cada una es `[lunes, lunes
    siguiente)` en UTC. Lunes porque el reporte semanal se arma los lunes con
    la semana que terminó."""
    if not 1 <= weeks <= MAX_WEEKS:
        raise ValueError(f"La serie tiene que tener entre 1 y {MAX_WEEKS} semanas")
    today = to_art(now).date()
    this_monday = today - timedelta(days=today.weekday())
    first_monday = this_monday - timedelta(weeks=weeks - 1)
    return [
        (
            _midnight_utc(first_monday + timedelta(weeks=i)),
            _midnight_utc(first_monday + timedelta(weeks=i + 1)),
        )
        for i in range(weeks)
    ]
