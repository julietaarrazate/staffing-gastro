"""Tests de las utilidades puras de geolocalización (app/core/geo.py)."""

import math

from app.core.geo import (
    FUZZ_MAX_RADIUS_KM,
    FUZZ_MIN_RADIUS_KM,
    fuzz_point,
    haversine_km,
)


def test_fuzz_point_stays_within_the_ring():
    lat, lng = fuzz_point(-34.58, -58.43, "worker-1")
    assert lat is not None and lng is not None

    distance = haversine_km(-34.58, -58.43, lat, lng)
    # Margen chico por el redondeo de proyectar km a grados de lat/lng.
    assert FUZZ_MIN_RADIUS_KM - 0.01 <= distance <= FUZZ_MAX_RADIUS_KM + 0.01


def test_fuzz_point_is_deterministic_for_the_same_seed():
    """Mismo trabajador → mismo punto en cada render, no un salto en cada
    recarga del mapa del comercio (ver el docstring de `fuzz_point`)."""
    first = fuzz_point(-34.58, -58.43, "worker-1")
    second = fuzz_point(-34.58, -58.43, "worker-1")
    assert first == second


def test_fuzz_point_differs_by_seed():
    """Dos trabajadores en la misma coordenada no deben desplazarse al mismo
    punto — si no, "distintos puntos" sería en realidad "el mismo dato" con
    otro nombre."""
    a = fuzz_point(-34.58, -58.43, "worker-1")
    b = fuzz_point(-34.58, -58.43, "worker-2")
    assert a != b


def test_fuzz_point_never_returns_the_exact_input():
    lat, lng = fuzz_point(-34.58, -58.43, "worker-1")
    assert (lat, lng) != (-34.58, -58.43)


def test_fuzz_point_passes_through_none():
    assert fuzz_point(None, -58.43, "worker-1") == (None, None)
    assert fuzz_point(-34.58, None, "worker-1") == (None, None)


def test_haversine_km_none_when_missing_data():
    assert haversine_km(None, -58.43, -34.58, -58.43) is None


def test_haversine_km_zero_for_same_point():
    assert haversine_km(-34.58, -58.43, -34.58, -58.43) == 0


def test_haversine_km_matches_a_known_degree_of_latitude():
    # Un grado de latitud mide ~111.19 km en cualquier punto del globo
    # (a diferencia de un grado de longitud, que depende de la latitud).
    distance = haversine_km(-34.0, -58.0, -33.0, -58.0)
    assert math.isclose(distance, 111.19, abs_tol=0.5)


# --- «Cerca»: caja de coordenadas y comparación de ciudad --------------------


def test_bounding_box_contains_the_whole_circle():
    """La caja es el filtro grueso que va a SQL: tiene que contener TODO el
    círculo (después se mide la distancia exacta), sin dejar afuera a nadie
    que esté dentro del radio en ninguna dirección."""
    from app.core.geo import bounding_box

    lat, lng, radius = -34.58, -58.43, 40.0
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius)

    for bearing in range(0, 360, 5):
        angle = math.radians(bearing)
        # Punto a 39,9 km en esa dirección (proyección local, alcanza acá).
        d_lat = (39.9 / 111.19) * math.cos(angle)
        d_lng = (39.9 / (111.19 * math.cos(math.radians(lat)))) * math.sin(angle)
        point = (lat + d_lat, lng + d_lng)
        assert haversine_km(lat, lng, *point) < radius
        assert min_lat <= point[0] <= max_lat
        assert min_lng <= point[1] <= max_lng


def test_bounding_box_is_not_much_bigger_than_the_circle():
    """Y tampoco es el país entero: lo que queda en las esquinas de la caja
    está, como mucho, a ~1,5 veces el radio."""
    from app.core.geo import bounding_box

    lat, lng, radius = -34.58, -58.43, 40.0
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius)
    for corner in ((min_lat, min_lng), (min_lat, max_lng), (max_lat, min_lng), (max_lat, max_lng)):
        assert haversine_km(lat, lng, *corner) < radius * 1.5


def test_same_city_ignores_case_accents_and_extra_spaces():
    from app.core.geo import same_city

    assert same_city("Bahía Blanca", "bahia blanca")
    assert same_city("  CÓRDOBA ", "Cordoba")
    assert same_city("San  Miguel de Tucumán", "san miguel de tucuman")
    assert not same_city("Córdoba", "Rosario")


def test_same_city_is_false_when_either_side_is_missing():
    """Sin ciudad no hay con qué comparar: nunca cuenta como «la misma»."""
    from app.core.geo import same_city

    assert not same_city(None, "Palermo")
    assert not same_city("Palermo", None)
    assert not same_city(None, None)
    assert not same_city("", "")
    assert not same_city("   ", "   ")
