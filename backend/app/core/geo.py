"""Utilidades de geolocalización compartidas (fórmula de Haversine)."""

import hashlib
import math

EARTH_RADIUS_KM = 6371.0


def haversine_km(
    lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None
) -> float | None:
    """Distancia en kilómetros entre dos puntos. None si falta algún dato."""
    if None in (lat1, lon1, lat2, lon2):
        return None

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


# TECH_DEBT.md S4 / ADR-0014 §3: el mapa del comercio (y el de admin, mismo
# endpoint) mostraba el pin de un trabajador en su coordenada EXACTA — la
# de su domicilio, cargada en el onboarding. Un desplazamiento entre estos
# dos radios alcanza para decidir a quién contactar (sigue en su cuadra) y
# no alcanza para ir a golpear una puerta.
FUZZ_MIN_RADIUS_KM = 0.15
FUZZ_MAX_RADIUS_KM = 0.35


def fuzz_point(
    lat: float | None, lng: float | None, seed: str
) -> tuple[float | None, float | None]:
    """Desplaza `(lat, lng)` a un punto pseudo-aleatorio pero determinístico
    (mismo `seed` → siempre el mismo resultado) dentro de un anillo entre
    `FUZZ_MIN_RADIUS_KM` y `FUZZ_MAX_RADIUS_KM`.

    Determinístico a propósito: el mismo trabajador tiene que aparecer en el
    mismo punto en cada render, no saltar cada vez que el comercio recarga el
    mapa — eso sería peor que la coordenada exacta (invita a promediar varias
    lecturas para deshacer el desplazamiento). `hashlib.sha256` en vez de
    `hash()`/`random.seed()`: ambos varían entre procesos (`PYTHONHASHSEED`),
    así que el mismo trabajador se desplazaría distinto en cada request.
    """
    if lat is None or lng is None:
        return None, None

    digest = hashlib.sha256(seed.encode()).digest()
    angle = (int.from_bytes(digest[:4], "big") / 2**32) * 2 * math.pi
    distance_km = FUZZ_MIN_RADIUS_KM + (int.from_bytes(digest[4:8], "big") / 2**32) * (
        FUZZ_MAX_RADIUS_KM - FUZZ_MIN_RADIUS_KM
    )

    d_lat = (distance_km / EARTH_RADIUS_KM) * (180 / math.pi)
    d_lng = (
        (distance_km / EARTH_RADIUS_KM)
        * (180 / math.pi)
        / math.cos(math.radians(lat))
    )
    return lat + d_lat * math.cos(angle), lng + d_lng * math.sin(angle)
