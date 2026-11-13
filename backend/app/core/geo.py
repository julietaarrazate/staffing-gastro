"""Utilidades de geolocalización compartidas (fórmula de Haversine)."""

import hashlib
import math
import unicodedata

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


def bounding_box(
    lat: float, lng: float, radius_km: float
) -> tuple[float, float, float, float]:
    """Caja `(lat_min, lat_max, lng_min, lng_max)` que contiene entero el
    círculo de `radius_km` alrededor de `(lat, lng)`.

    Es el filtro GRUESO de «cerca»: comparaciones simples de coordenadas que
    cualquier base resuelve (Postgres en producción, SQLite en los tests, sin
    PostGIS). La caja sobra en las esquinas a propósito; quien la usa mide
    después la distancia exacta con `haversine_km`.
    """
    # 1% de margen: que un redondeo nunca deje afuera a alguien del borde.
    angular = (radius_km / EARTH_RADIUS_KM) * 1.01
    d_lat = math.degrees(angular)
    # Los meridianos se juntan hacia los polos: un mismo radio abarca más
    # grados de longitud cuanto más lejos del ecuador. Se usa la latitud más
    # alejada del ecuador que toca el círculo, que es donde más abarca.
    widest_lat = min(abs(lat) + d_lat, 89.0)
    d_lng = math.degrees(angular / math.cos(math.radians(widest_lat)))
    return lat - d_lat, lat + d_lat, lng - d_lng, lng + d_lng


def normalize_city(name: str | None) -> str | None:
    """Nombre de ciudad listo para comparar: sin mayúsculas, sin tildes y sin
    espacios de más. `None` si no hay nada escrito.

    La ciudad es texto libre en el perfil y en el turno («Córdoba»,
    «cordoba », «CORDOBA»): comparar tal cual dejaba afuera a la misma ciudad
    escrita de otra forma."""
    if not name:
        return None
    decomposed = unicodedata.normalize("NFKD", name)
    plain = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    collapsed = " ".join(plain.casefold().split())
    return collapsed or None


def same_city(a: str | None, b: str | None) -> bool:
    """¿Es la misma ciudad? Falso si falta alguna de las dos: sin ciudad no
    hay con qué comparar, y eso nunca cuenta como «la misma»."""
    left, right = normalize_city(a), normalize_city(b)
    return left is not None and left == right


def is_near(
    distance_km: float | None,
    radius_km: float,
    city: str | None,
    other_city: str | None,
) -> bool:
    """La regla de «cerca», una sola para los avisos y para las listas.

    - Con distancia medible: adentro del radio, borde incluido.
    - Sin distancia (a alguna de las dos puntas le faltan coordenadas): sólo
      si la ciudad es la misma. Sin ciudad en alguna de las dos, no es cerca.
    """
    if distance_km is not None:
        return distance_km <= radius_km
    return same_city(city, other_city)


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
