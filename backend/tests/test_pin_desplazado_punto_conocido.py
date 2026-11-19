"""Un punto real conocido no deshace el pin desplazado del domicilio
(pasada de privacidad 2026-11-19, PRI-02). Antes el desplazamiento era un
vector fijo por trabajador: un comercio que conocía UNA posición real (su
propio local, donde la persona prendió «Disponible ahora» al salir del turno)
sacaba el vector y con él el domicilio exacto (ADR-0014, 2026-11-19)."""

import math
import random

import pytest
from httpx import AsyncClient

from app.core.geo import (
    EARTH_RADIUS_KM,
    FUZZ_CELL_KM,
    FUZZ_MAX_RADIUS_KM,
    FUZZ_MIN_RADIUS_KM,
    _FUZZ_ROUNDING_MARGIN_KM,
    _fuzz_cell,
    fuzz_point,
    haversine_km,
)
from tests.conftest import auth_headers


_DOMICILIO = (-34.5875, -58.4251)
_LOCAL = (-34.6037, -58.3816)


async def _pin(client: AsyncClient, employer: dict) -> tuple[float, float]:
    found = await client.get(
        "/api/v1/matching/search",
        headers=employer,
        params={"latitude": _LOCAL[0], "longitude": _LOCAL[1]},
    )
    assert found.status_code == 200
    [worker] = found.json()
    return worker["latitude"], worker["longitude"]


@pytest.mark.asyncio
async def test_un_punto_conocido_no_deshace_el_desplazamiento_del_domicilio(
    client: AsyncClient,
):
    employer = await auth_headers(client, "employer", "pri02_emp@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer,
        json={"name": "Bar Pri02", "city": "CABA", "latitude": _LOCAL[0], "longitude": _LOCAL[1]},
    )
    worker = await auth_headers(client, "worker", "pri02_w@staffya.com")
    created = await client.post(
        "/api/v1/workers/me/profile",
        headers=worker,
        json={
            "skills": ["mozo"],
            "latitude": _DOMICILIO[0],
            "longitude": _DOMICILIO[1],
            "is_available": True,
        },
    )
    assert created.status_code == 201

    # Terminó el turno en el local y prendió «Disponible ahora» ahí mismo.
    on = await client.post(
        "/api/v1/workers/me/available-now",
        headers=worker,
        json={"latitude": _LOCAL[0], "longitude": _LOCAL[1]},
    )
    assert on.status_code == 200
    pin_vivo = await _pin(client, employer)
    vector = (pin_vivo[0] - _LOCAL[0], pin_vivo[1] - _LOCAL[1])

    # Lo apaga (o vence a las 4 h): el mapa vuelve a la zona del perfil.
    await client.delete("/api/v1/workers/me/available-now", headers=worker)
    pin_casa = await _pin(client, employer)
    deducido = (pin_casa[0] - vector[0], pin_casa[1] - vector[1])

    error_km = haversine_km(deducido[0], deducido[1], _DOMICILIO[0], _DOMICILIO[1])
    # Con el vector fijo, lo deducido caía a 0,05 mm del domicilio. Ahora el
    # vector que el comercio aprende en su local es el de la celda del local
    # y el pin de la casa sale de otra celda con otro vector: lo «deducido»
    # es un punto cualquiera a cientos de metros. El umbral es 1 m y no los
    # 150 m del pin: el id del perfil es al azar en cada corrida, y un punto
    # cualquiera puede caer a menos de 150 m de la casa (pasó una vez cada
    # cien); a menos de 1 m, una vez en cientos de miles.
    assert error_km > 0.001, f"domicilio deducido a {error_km * 1000:.2f} m del real"


# Lo encontró la revisión independiente del 2026-11-19: el pin con todos sus
# decimales delataba la celda sin la clave ni ningún punto conocido. El
# ángulo y el radio salen de enteros de 32 bits del HMAC: deshaciendo la
# cuenta desde cada centro de celda candidato, sólo el verdadero daba
# enteros. Por eso el pin publicado va redondeado (`FUZZ_DECIMALS`).
_PASO_LAT = FUZZ_CELL_KM / (EARTH_RADIUS_KM * math.pi / 180)
_MEDIA_DIAGONAL = FUZZ_CELL_KM * math.sqrt(2) / 2


def _celdas_que_pasan(p_lat: float, p_lng: float) -> list[tuple[int, int]]:
    """Las celdas cuyo centro, al deshacer la cuenta, da ángulo y radio
    enteros (en unidades de 2**-32). Usa sólo constantes públicas."""
    def fraccion(x: float) -> float:
        return abs(x - round(x))

    pasan = []
    f0 = math.floor(p_lat / _PASO_LAT)
    for fila in range(f0 - 4, f0 + 5):
        c_lat = (fila + 0.5) * _PASO_LAT
        paso_lng = _PASO_LAT / math.cos(math.radians(c_lat))
        c0 = math.floor(p_lng / paso_lng)
        for col in range(c0 - 4, c0 + 5):
            c_lng = (col + 0.5) * paso_lng
            a = p_lat - c_lat
            b = (p_lng - c_lng) * math.cos(math.radians(c_lat))
            radio = math.hypot(a, b) * (math.pi / 180) * EARTH_RADIUS_KM
            u_radio = (radio - _MEDIA_DIAGONAL - _FUZZ_ROUNDING_MARGIN_KM - FUZZ_MIN_RADIUS_KM) / (
                FUZZ_MAX_RADIUS_KM - FUZZ_MIN_RADIUS_KM
            ) * 2**32
            u_angulo = (math.atan2(b, a) % (2 * math.pi)) / (2 * math.pi) * 2**32
            if 0 <= round(u_radio) < 2**32 and fraccion(u_angulo) < 0.01 and fraccion(u_radio) < 0.1:
                pasan.append((fila, col))
    return pasan


def test_el_pin_publicado_no_delata_su_celda():
    azar = random.Random(20261119)
    delatadas = 0
    for i in range(50):
        lat, lng = azar.uniform(-34.75, -34.50), azar.uniform(-58.55, -58.30)
        p_lat, p_lng = fuzz_point(lat, lng, f"trabajador-{i}")
        if _celdas_que_pasan(p_lat, p_lng) == [_fuzz_cell(lat, lng)[:2]]:
            delatadas += 1
    # Con todos los decimales pasaban 50 de 50; redondeado, sólo por azar.
    assert delatadas < 5, f"{delatadas} de 50 pines delatan su celda exacta"
