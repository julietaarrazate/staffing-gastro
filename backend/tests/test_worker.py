"""Tests de integración del módulo worker (perfil del trabajador)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def test_worker_creates_profile(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo1@staffya.com")
    response = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={
            "city": "Palermo",
            "skills": ["mozo", "bartender"],
            "years_experience": 3,
            "languages": ["español", "inglés"],
            "birth_date": "1995-05-20",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["city"] == "Palermo"
    assert body["skills"] == ["mozo", "bartender"]
    assert body["level"] == "bronce"
    assert body["rating"] == 0.0
    assert body["age"] is not None


async def test_worker_cannot_create_two_profiles(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo2@staffya.com")
    await client.post("/api/v1/workers/me/profile", headers=headers, json={})
    second = await client.post("/api/v1/workers/me/profile", headers=headers, json={})
    assert second.status_code == 409


async def test_worker_metrics_are_not_editable(client: AsyncClient):
    """Los campos de métricas enviados por el cliente deben ignorarse."""
    headers = await auth_headers(client, "worker", "mozo3@staffya.com")
    response = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"city": "Centro", "rating": 5.0, "events_completed": 999},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["rating"] == 0.0
    assert body["events_completed"] == 0


async def test_worker_get_and_update_profile(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo4@staffya.com")
    await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"city": "Belgrano"}
    )

    got = await client.get("/api/v1/workers/me/profile", headers=headers)
    assert got.status_code == 200
    assert got.json()["city"] == "Belgrano"

    updated = await client.put(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"city": "Recoleta", "is_available": False},
    )
    assert updated.status_code == 200
    assert updated.json()["city"] == "Recoleta"
    assert updated.json()["is_available"] is False


async def test_worker_cv_filename_roundtrips_with_cv_url(client: AsyncClient):
    """F1 (auditoría de producto 2026-08-10): el nombre de archivo real del CV
    se guarda aparte de la URL (el `public_id` de Cloudinary es un hash)."""
    headers = await auth_headers(client, "worker", "mozo_cv@staffya.com")
    created = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={
            "city": "Palermo",
            "cv_url": "https://res.cloudinary.com/demo/raw/upload/v1/abc123hash.pdf",
            "cv_filename": "Mi CV actualizado.pdf",
        },
    )
    assert created.status_code == 201
    assert created.json()["cv_filename"] == "Mi CV actualizado.pdf"

    got = await client.get("/api/v1/workers/me/profile", headers=headers)
    assert got.json()["cv_filename"] == "Mi CV actualizado.pdf"

    # Al quitar el CV (URL vacía), no debería quedar un nombre huérfano.
    updated = await client.put(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"cv_url": None, "cv_filename": None},
    )
    assert updated.status_code == 200
    assert updated.json()["cv_url"] is None
    assert updated.json()["cv_filename"] is None


async def test_employer_cannot_create_worker_profile(client: AsyncClient):
    headers = await auth_headers(client, "employer", "empleador1@staffya.com")
    response = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"city": "Palermo"}
    )
    assert response.status_code == 403


async def test_get_profile_not_found(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo5@staffya.com")
    response = await client.get(
        "/api/v1/workers/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert response.status_code == 404
