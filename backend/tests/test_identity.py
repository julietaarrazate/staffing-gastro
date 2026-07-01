"""Tests de integración del módulo de identidad (registro, login, refresh, /me)."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters

pytestmark = pytest.mark.asyncio


async def _register(client: AsyncClient, **overrides) -> dict:
    payload = {
        "email": "mozo@staffya.com",
        "password": "supersecreta123",
        "full_name": "Juan Mozo",
        "role": "worker",
    }
    payload.update(overrides)
    response = await client.post("/api/v1/auth/register", json=payload)
    return response


async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_register_success(client: AsyncClient):
    response = await _register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "mozo@staffya.com"
    assert body["role"] == "worker"
    assert body["is_verified"] is False
    assert "id" in body


async def test_register_duplicate_email(client: AsyncClient):
    await _register(client)
    response = await _register(client)
    assert response.status_code == 409


async def test_register_short_password(client: AsyncClient):
    response = await _register(client, password="corta")
    assert response.status_code == 422


async def test_login_success_and_me(client: AsyncClient):
    await _register(client)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "mozo@staffya.com", "password": "supersecreta123"},
    )
    assert login.status_code == 200
    tokens = login.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "mozo@staffya.com"


async def test_login_wrong_password(client: AsyncClient):
    await _register(client)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "mozo@staffya.com", "password": "incorrecta"},
    )
    assert login.status_code == 401


async def test_refresh_rotates_tokens(client: AsyncClient):
    await _register(client)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "mozo@staffya.com", "password": "supersecreta123"},
    )
    refresh_token = login.json()["refresh_token"]

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]


async def test_refresh_token_cannot_access_me(client: AsyncClient):
    """Un refresh token no debe servir como access token."""
    await _register(client)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "mozo@staffya.com", "password": "supersecreta123"},
    )
    refresh_token = login.json()["refresh_token"]

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert me.status_code == 401


async def test_me_requires_auth(client: AsyncClient):
    me = await client.get("/api/v1/auth/me")
    assert me.status_code in (401, 403)


async def test_register_cannot_self_assign_admin_role(client: AsyncClient):
    """El registro público no debe permitir elegir el rol admin."""
    response = await _register(client, role="admin")
    assert response.status_code == 422


async def test_login_rate_limited(client: AsyncClient):
    """Tras superar el límite por IP, el login responde 429."""
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        await _register(client)
        creds = {"email": "mozo@staffya.com", "password": "incorrecta"}
        statuses = [
            (await client.post("/api/v1/auth/login", json=creds)).status_code
            for _ in range(12)
        ]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    # El límite es 10/min: las primeras responden 401 y luego aparece un 429.
    assert 429 in statuses
    assert statuses.index(429) >= 10
