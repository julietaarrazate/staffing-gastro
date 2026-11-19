"""Utilidades de geolocalización compartidas (fórmula de Haversine)."""

import hashlib
import hmac
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
# Lado de la celda de la grilla del pin (ADR-0014, actualización
# 2026-11-19). El pin sale del CENTRO de la celda donde cae el punto, no del
# punto: dos lugares de la misma celda dan el mismo pin, así que ni un punto
# real conocido ni muchas lecturas dicen más que la celda. El anillo se mide
# desde el centro y se corre media diagonal de celda hacia afuera, para que
# el pin quede siempre entre `FUZZ_MIN_RADIUS_KM` y
# `FUZZ_MAX_RADIUS_KM + diagonal + 10 m` (~0,64 km) del punto real, nunca más cerca.
FUZZ_CELL_KM = 0.2
_FUZZ_HALF_DIAGONAL_KM = FUZZ_CELL_KM * math.sqrt(2) / 2
# El pin publicado va redondeado a 4 decimales (~10 m). Con todos sus
# decimales delataba la celda: el ángulo y el radio salen de enteros de 32
# bits del HMAC, así que deshaciendo la cuenta desde cada centro candidato
# sólo el verdadero daba enteros (revisión independiente del 2026-11-19). El
# redondeo mueve el pin hasta ~8 m: el anillo se corre ese margen más para
# conservar los 150 m.
FUZZ_DECIMALS = 4
_FUZZ_ROUNDING_MARGIN_KM = 0.01
_KM_POR_GRADO = EARTH_RADIUS_KM * math.pi / 180


def _fuzz_cell(lat: float, lng: float) -> tuple[int, int, float, float]:
    """La celda de la grilla donde cae `(lat, lng)`: sus índices y su
    centro. El paso en longitud se corrige por la latitud del centro de la
    fila, para que la celda mida lo mismo en los dos sentidos."""
    paso_lat = FUZZ_CELL_KM / _KM_POR_GRADO
    fila = math.floor(lat / paso_lat)
    centro_lat = (fila + 0.5) * paso_lat
    paso_lng = paso_lat / math.cos(math.radians(centro_lat))
    columna = math.floor(lng / paso_lng)
    return fila, columna, centro_lat, (columna + 0.5) * paso_lng


def _fuzz_key() -> bytes:
    """Clave del servidor para el desplazamiento: sin ella, cualquiera que
    conozca el id del perfil (el comercio lo ve) calculaba el vector. Sale de
    `JWT_SECRET_KEY`, separada por propósito, para no sumar otra variable de
    entorno. Si esa clave se rota, los pines se mueven una vez; cada rotación
    es otra muestra del pin de la misma celda, así que no se rota sin motivo
    (ADR-0014, actualización 2026-11-19)."""
    from app.core.config import settings  # import tardío: geo no depende de config al importarse

    return hashlib.sha256(b"oido-pin-desplazado:" + settings.jwt_secret_key.encode()).digest()


def fuzz_point(
    lat: float | None, lng: float | None, seed: str
) -> tuple[float | None, float | None]:
    """El pin público de un punto: el centro de su celda de la grilla
    (`FUZZ_CELL_KM`), desplazado a un punto pseudo-aleatorio pero
    determinístico dentro de un anillo alrededor de ese centro, redondeado a
    `FUZZ_DECIMALS`. El anillo va de `FUZZ_MIN_RADIUS_KM` a
    `FUZZ_MAX_RADIUS_KM` más media diagonal de celda y el margen del
    redondeo: así el pin queda a 150 m o más de CUALQUIER punto de la celda.

    Determinístico a propósito: el mismo trabajador en el mismo lugar tiene
    que aparecer en el mismo punto en cada render, no saltar cada vez que el
    comercio recarga el mapa — eso sería peor que la coordenada exacta
    (invita a promediar varias lecturas para deshacer el desplazamiento).

    Hasta el 2026-11-19 el desplazamiento salía sólo de `seed` (el id del
    perfil), igual para el domicilio y para cada posición de «Disponible
    ahora»: un comercio que conocía UN punto real de la persona (su propio
    local, donde la prendió) sacaba el vector y con él el domicilio exacto
    (pasada de privacidad, PRI-02). Ahora el vector depende también de la
    celda y de una clave del servidor, y parte del centro de la celda: un
    punto conocido sólo dice el pin de su propia celda, y del domicilio no se
    puede saber más que la celda en la que cae.

    HMAC-SHA256 en vez de `hash()`/`random.seed()`: ambos varían entre
    procesos (`PYTHONHASHSEED`), así que el mismo trabajador se desplazaría
    distinto en cada request.
    """
    if lat is None or lng is None:
        return None, None

    fila, columna, centro_lat, centro_lng = _fuzz_cell(lat, lng)
    digest = hmac.new(
        _fuzz_key(), f"{seed}:{fila}:{columna}".encode(), hashlib.sha256
    ).digest()
    angle = (int.from_bytes(digest[:4], "big") / 2**32) * 2 * math.pi
    distance_km = (
        _FUZZ_HALF_DIAGONAL_KM
        + _FUZZ_ROUNDING_MARGIN_KM
        + FUZZ_MIN_RADIUS_KM
        + (int.from_bytes(digest[4:8], "big") / 2**32)
        * (FUZZ_MAX_RADIUS_KM - FUZZ_MIN_RADIUS_KM)
    )

    d_lat = (distance_km / EARTH_RADIUS_KM) * (180 / math.pi)
    d_lng = (
        (distance_km / EARTH_RADIUS_KM)
        * (180 / math.pi)
        / math.cos(math.radians(centro_lat))
    )
    return (
        round(centro_lat + d_lat * math.cos(angle), FUZZ_DECIMALS),
        round(centro_lng + d_lng * math.sin(angle), FUZZ_DECIMALS),
    )
