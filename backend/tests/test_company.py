"""Tests de integración del módulo company (perfil del comercio)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_employer_creates_profile(client: AsyncClient):
    headers = await auth_headers(client, "employer", "rest1@staffya.com")
    response = await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={
            "name": "Bar Palermo",
            "category": "bar",
            "city": "Palermo",
            "capacity": 80,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Bar Palermo"
    assert body["category"] == "bar"
    assert body["rating"] == 0.0


async def test_company_name_is_required(client: AsyncClient):
    headers = await auth_headers(client, "employer", "rest2@staffya.com")
    response = await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"city": "Centro"}
    )
    assert response.status_code == 422


async def test_employer_cannot_create_two_profiles(client: AsyncClient):
    headers = await auth_headers(client, "employer", "rest3@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Resto"}
    )
    second = await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Resto"}
    )
    assert second.status_code == 409


async def test_worker_cannot_create_company_profile(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo_c@staffya.com")
    response = await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Resto"}
    )
    assert response.status_code == 403


async def test_company_get_and_update(client: AsyncClient):
    headers = await auth_headers(client, "employer", "rest4@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Café Centro"}
    )

    got = await client.get("/api/v1/companies/me/profile", headers=headers)
    assert got.status_code == 200
    assert got.json()["name"] == "Café Centro"

    updated = await client.put(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Café Centro", "category": "cafeteria", "capacity": 40},
    )
    assert updated.status_code == 200
    assert updated.json()["category"] == "cafeteria"
    assert updated.json()["capacity"] == 40


async def test_editar_sin_mandar_rubro_descripcion_capacidad_ni_horarios_no_los_borra(
    client: AsyncClient,
):
    """U119: «Datos del comercio» no manda esos campos y no debe vaciarlos."""
    headers = await auth_headers(client, "employer", "parcial1@staffya.com")
    created = await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={
            "name": "Bar Palermo",
            "category": "bar",
            "description": "Cervecería de barrio",
            "capacity": 80,
            "opening_hours": "Lun a Sáb 18 a 2",
        },
    )
    assert created.status_code == 201
    updated = await client.put(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo Soho", "city": "Palermo"},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Bar Palermo Soho"
    assert body["city"] == "Palermo"
    assert body["category"] == "bar"
    assert body["description"] == "Cervecería de barrio"
    assert body["capacity"] == 80
    assert body["opening_hours"] == "Lun a Sáb 18 a 2"
    me = await client.get("/api/v1/companies/me/profile", headers=headers)
    assert me.json()["opening_hours"] == "Lun a Sáb 18 a 2"


async def test_mandar_null_explicito_si_vacia_los_campos_parciales(client: AsyncClient):
    headers = await auth_headers(client, "employer", "parcial2@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar", "category": "bar", "description": "x", "capacity": 10, "opening_hours": "24hs"},
    )
    updated = await client.put(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar", "category": None, "description": None, "capacity": None, "opening_hours": None},
    )
    body = updated.json()
    assert body["category"] is None
    assert body["description"] is None
    assert body["capacity"] is None
    assert body["opening_hours"] is None


async def test_mandar_un_valor_nuevo_lo_reemplaza(client: AsyncClient):
    headers = await auth_headers(client, "employer", "parcial3@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Bar", "capacity": 10}
    )
    updated = await client.put(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Bar", "capacity": 40}
    )
    assert updated.json()["capacity"] == 40
