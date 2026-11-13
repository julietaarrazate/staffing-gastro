"""Qué turnos están «cerca» de quien mira el feed (puro, sin frameworks).

Es la contracara de `matching.domain.scoring.is_within_radius`: allá se
decide a qué trabajadores se les avisa de un turno, acá qué turnos se le
muestran a un trabajador. Las dos usan la misma regla (`app.core.geo.is_near`)
para que el aviso y la lista no se contradigan.
"""

from dataclasses import dataclass

from app.core.geo import haversine_km, is_near, normalize_city
from app.modules.shift.domain.entities import Shift


@dataclass(frozen=True)
class FeedOrigin:
    """Desde dónde se mide «cerca»: un punto, una ciudad, las dos cosas o
    ninguna. Por defecto es la zona del perfil del trabajador."""

    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None

    @property
    def point(self) -> tuple[float, float] | None:
        if self.latitude is None or self.longitude is None:
            return None
        return (self.latitude, self.longitude)

    @property
    def is_known(self) -> bool:
        """¿Hay con qué decidir qué queda cerca? Sin punto ni ciudad, no."""
        return self.point is not None or normalize_city(self.city) is not None


def distance_from(origin: FeedOrigin, shift: Shift) -> float | None:
    """Distancia exacta del turno al origen; `None` si a alguno le faltan
    coordenadas."""
    return haversine_km(origin.latitude, origin.longitude, shift.latitude, shift.longitude)


def is_nearby(shift: Shift, origin: FeedOrigin, radius_km: float) -> bool:
    return is_near(distance_from(origin, shift), radius_km, shift.city, origin.city)


def _newest_first(shifts: list[Shift]) -> list[Shift]:
    # `created_at` siempre viene de la base; el respaldo es para un turno
    # todavía sin guardar, que no rompa el orden.
    dated = [s for s in shifts if s.created_at is not None]
    undated = [s for s in shifts if s.created_at is None]
    return sorted(dated, key=lambda s: s.created_at, reverse=True) + undated


def closest_first(shifts: list[Shift], origin: FeedOrigin) -> list[Shift]:
    """Del más cercano al más lejano; a igual distancia, el más nuevo. Los
    que no se pueden medir (sin coordenadas) van al final."""

    def key(shift: Shift) -> tuple[bool, float]:
        distance = distance_from(origin, shift)
        return (distance is None, distance or 0.0)

    # `sorted` es estable: el orden por fecha queda como desempate.
    return sorted(_newest_first(shifts), key=key)


def urgent_first(shifts: list[Shift], origin: FeedOrigin) -> list[Shift]:
    """Urgentes primero; dentro de cada grupo, por cercanía y después el más
    nuevo."""
    return sorted(closest_first(shifts, origin), key=lambda s: not s.urgent)
