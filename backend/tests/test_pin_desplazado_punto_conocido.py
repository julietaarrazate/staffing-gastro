"""Un punto real conocido no deshace el pin desplazado del domicilio
(pasada de privacidad 2026-11-19, PRI-02). Antes el desplazamiento era un
vector fijo por trabajador: un comercio que conocía UNA posición real (su
propio local, donde la persona prendió «Disponible ahora» al salir del turno)
sacaba el vector y con él el domicilio exacto (ADR-0014, 2026-11-19)."""

import pytest
from httpx import AsyncClient

from app.core.geo import haversine_km
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

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
    # El pin promete «no alcanza para llegar a tu puerta» (anillo de 150 a
    # 350 m). Con un solo punto conocido el comercio queda a metros.
    assert error_km >= 0.15, f"domicilio deducido a {error_km * 1000:.1f} m del real"
