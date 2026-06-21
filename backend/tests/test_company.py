"""Tests de integración del módulo company (perfil del comercio)."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _auth_headers(client: AsyncClient, role: str, email: str) -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "supersecreta123",
            "full_name": "Test User",
            "role": role,
        },
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "supersecreta123"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_employer_creates_profile(client: AsyncClient):
    headers = await _auth_headers(client, "employer", "rest1@staffya.com")
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
    headers = await _auth_headers(client, "employer", "rest2@staffya.com")
    response = await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"city": "Centro"}
    )
    assert response.status_code == 422


async def test_employer_cannot_create_two_profiles(client: AsyncClient):
    headers = await _auth_headers(client, "employer", "rest3@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Resto"}
    )
    second = await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Resto"}
    )
    assert second.status_code == 409


async def test_worker_cannot_create_company_profile(client: AsyncClient):
    headers = await _auth_headers(client, "worker", "mozo_c@staffya.com")
    response = await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Resto"}
    )
    assert response.status_code == 403


async def test_company_get_and_update(client: AsyncClient):
    headers = await _auth_headers(client, "employer", "rest4@staffya.com")
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
