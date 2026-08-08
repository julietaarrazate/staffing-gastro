"""Tests del acceso de invitado para la beta (POST /auth/guest)."""

import pytest
from httpx import AsyncClient

from app.modules.identity.application.services import GUEST_ACCESS_PIN

pytestmark = pytest.mark.asyncio


async def test_guest_login_wrong_pin_is_401(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": "pin-incorrecto", "role": "worker"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "PIN incorrecto"


async def test_guest_login_worker_creates_and_reuses_account(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": GUEST_ACCESS_PIN, "role": "worker"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert "refresh_token" not in body
    assert resp.cookies.get("staffya_refresh")
    assert body["user"]["role"] == "worker"

    # Idempotente: un segundo ingreso reusa la MISMA cuenta invitada compartida.
    again = await client.post(
        "/api/v1/auth/guest", json={"pin": GUEST_ACCESS_PIN, "role": "worker"}
    )
    assert again.json()["user"]["id"] == body["user"]["id"]


async def test_guest_login_employer_role(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": GUEST_ACCESS_PIN, "role": "employer"}
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "employer"


async def test_guest_default_role_is_worker(client: AsyncClient):
    resp = await client.post("/api/v1/auth/guest", json={"pin": GUEST_ACCESS_PIN})
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "worker"
