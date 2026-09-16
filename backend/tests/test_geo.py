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
