"""Qué turnos están «cerca» de quien mira el feed (puro, sin frameworks).

Es la contracara de `matching.domain.scoring.is_within_radius`: allá se
decide a qué trabajadores se les avisa de un turno, acá qué turnos se le
muestran a un trabajador. Las dos usan la misma regla (`app.core.geo.is_near`)
y miden el turno desde el mismo lugar (`zone_of`), para que el aviso y la
lista no se contradigan.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID

from app.core.geo import haversine_km, is_near, normalize_city
from app.modules.shift.domain.entities import Shift


@dataclass(frozen=True)
class Zone:
    """Dónde queda algo: un punto, una ciudad, las dos cosas o ninguna."""

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


@dataclass(frozen=True)
class FeedOrigin(Zone):
    """Desde dónde se mide «cerca» en el feed. Por defecto es la zona del
    perfil del trabajador."""


# Local de cada comercio (por id de comercio), para los turnos que no dicen
# dónde son. Ver `zone_of`.
Locals = Mapping[UUID, Zone]


def zone_of(shift: Shift, local: Zone | None = None) -> Zone:
    """Dónde queda el turno a la hora de medir «cerca».

    Es la zona que el comercio le puso al turno (coordenadas, ciudad o las
    dos). Si no le puso NADA —la API lo permite—, se mide desde el local del
    comercio: un turno que no dice dónde es, es en el local. Sin este respaldo
    el radio como límite duro lo dejaba sin contra qué medirse: no le avisaba
    a nadie y no aparecía en el Inicio ni en el Mapa de quien tiene zona.

    El respaldo es sólo para medir: el turno sigue sin ubicación propia (no
    se le inventa un pin ni una ciudad en la tarjeta). Y sólo cuando no hay
    nada: un turno con ciudad y sin coordenadas se compara por SU ciudad,
    aunque el local quede en otra (un evento fuera del local).
    """
    own = Zone(latitude=shift.latitude, longitude=shift.longitude, city=shift.city)
    if own.is_known or local is None:
        return own
    return local


def _zone(shift: Shift, locals_: Locals | None) -> Zone:
    return zone_of(shift, locals_.get(shift.company_id) if locals_ else None)


def distance_from(
    origin: FeedOrigin, shift: Shift, locals_: Locals | None = None
) -> float | None:
    """Distancia exacta del turno al origen; `None` si a alguno le faltan
    coordenadas."""
    zone = _zone(shift, locals_)
    return haversine_km(origin.latitude, origin.longitude, zone.latitude, zone.longitude)


def is_nearby(
    shift: Shift, origin: FeedOrigin, radius_km: float, locals_: Locals | None = None
) -> bool:
    return is_near(
        distance_from(origin, shift, locals_),
        radius_km,
        _zone(shift, locals_).city,
        origin.city,
    )


def _newest_first(shifts: list[Shift]) -> list[Shift]:
    # `created_at` siempre viene de la base; el respaldo es para un turno
    # todavía sin guardar, que no rompa el orden.
    dated = [s for s in shifts if s.created_at is not None]
    undated = [s for s in shifts if s.created_at is None]
    return sorted(dated, key=lambda s: s.created_at, reverse=True) + undated


def closest_first(
    shifts: list[Shift], origin: FeedOrigin, locals_: Locals | None = None
) -> list[Shift]:
    """Del más cercano al más lejano; a igual distancia, el más nuevo. Los
    que no se pueden medir (sin coordenadas) van al final."""

    def key(shift: Shift) -> tuple[bool, float]:
        distance = distance_from(origin, shift, locals_)
        return (distance is None, distance or 0.0)

    # `sorted` es estable: el orden por fecha queda como desempate.
    return sorted(_newest_first(shifts), key=key)


def urgent_first(
    shifts: list[Shift], origin: FeedOrigin, locals_: Locals | None = None
) -> list[Shift]:
    """Urgentes primero; dentro de cada grupo, por cercanía y después el más
    nuevo."""
    return sorted(closest_first(shifts, origin, locals_), key=lambda s: not s.urgent)
