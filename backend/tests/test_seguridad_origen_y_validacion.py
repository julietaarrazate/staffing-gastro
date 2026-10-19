"""Origin en endpoints con cookie de refresh y forma de los 422."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import login, register_user

pytestmark = pytest.mark.asyncio

ALLOWED = settings.cors_origins_list[0]


async def test_refresh_con_origen_permitido(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    r = await client.post("/api/v1/auth/refresh", headers={"Origin": ALLOWED})
    assert r.status_code == 200


async def test_refresh_con_origen_ajeno_403(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    r = await client.post("/api/v1/auth/refresh", headers={"Origin": "https://otro.example"})
    assert r.status_code == 403


async def test_refresh_sin_origen_pasa(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200


async def test_logout_origen_ajeno_403_y_no_revoca(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    bad = await client.post("/api/v1/auth/logout", headers={"Origin": "https://otro.example"})
    assert bad.status_code == 403
    ok = await client.post("/api/v1/auth/logout", headers={"Origin": ALLOWED})
    assert ok.status_code == 204
    assert (await client.post("/api/v1/auth/logout")).status_code == 204


async def test_422_no_devuelve_input_ni_ctx(client: AsyncClient):
    r = await client.post(
        "/api/v1/auth/login", json={"email": "no-es-mail", "password": "secreto-que-no-debe-volver"}
    )
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert errors
    for e in errors:
        assert set(e) == {"type", "loc", "msg"}
    assert "secreto-que-no-debe-volver" not in r.text
