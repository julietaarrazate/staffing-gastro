"""Cuándo refrescar la copia de OpenStreetMap de cada barrio (ADR-0029).

Regla pura, sin reloj ni base: el caso de uso le pasa las fechas de las
copias, la hora y el estado en memoria del refresco (pedidos y barrios en
pausa por una falla reciente).
"""

from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta

from app.modules.lead.domain.value_objects import BARRIOS_CABA

# Una copia vieja de más de una semana se vuelve a bajar. Los comercios de
# un barrio cambian despacio y Overpass es un servicio comunitario saturado.
SNAPSHOT_MAX_AGE = timedelta(days=7)


def next_refresh(
    fetched_at: Mapping[str, datetime],
    now: datetime,
    *,
    requested: Sequence[str] = (),
    resting_until: Mapping[str, datetime] | None = None,
    barrios: Iterable[str] = BARRIOS_CABA,
    max_age: timedelta = SNAPSHOT_MAX_AGE,
) -> tuple[str | None, datetime | None]:
    """El barrio a refrescar ahora, o cuándo vence la próxima copia.

    Devuelve `(barrio, None)` si hay uno para bajar ya, o `(None, cuándo)` si
    todos están al día (o en pausa). Orden: primero los pedidos desde la
    pantalla (`requested`, el último pedido adelante), después los que no
    tienen copia (en el orden de la lista) y por último la copia más vieja.
    Un barrio en `resting_until` (falló hace poco) espera hasta esa hora.
    """
    resting = resting_until or {}
    all_barrios = list(barrios)
    known = set(all_barrios)

    def due_at(barrio: str) -> datetime:
        fetched = fetched_at.get(barrio)
        due = now if fetched is None else fetched + max_age
        rest = resting.get(barrio)
        return max(due, rest) if rest is not None else due

    order = [b for b in dict.fromkeys(requested) if b in known]
    missing = [b for b in all_barrios if b not in fetched_at and b not in order]
    stale = sorted(
        (b for b in all_barrios if b in fetched_at and b not in order),
        key=lambda b: fetched_at[b],
    )
    for barrio in order + missing + stale:
        if due_at(barrio) <= now:
            return barrio, None
    if not all_barrios:
        return None, None
    return None, min(due_at(b) for b in all_barrios)
