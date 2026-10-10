"""Tests del acceso de invitado para la beta (POST /auth/guest)."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import TEST_GUEST_PIN

pytestmark = pytest.mark.asyncio


async def test_guest_login_wrong_pin_is_401(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": "pin-incorrecto", "role": "worker"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "PIN incorrecto"


async def test_guest_login_non_ascii_pin_is_401_not_500(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": "ñandú", "role": "worker"}
    )
    assert resp.status_code == 401


async def test_guest_login_disabled_without_pin_is_404(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    # Sin `GUEST_ACCESS_PIN` el acceso invitado está apagado: ni siquiera el
    # PIN viejo (que quedó en la historia pública del repo) entra.
    monkeypatch.setattr(settings, "guest_access_pin", "")
    for pin in ("3526", TEST_GUEST_PIN):
        resp = await client.post(
            "/api/v1/auth/guest", json={"pin": pin, "role": "employer"}
        )
        assert resp.status_code == 404


async def test_guest_login_worker_creates_and_reuses_account(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "worker"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert "refresh_token" not in body
    assert resp.cookies.get("staffya_refresh")
    assert body["user"]["role"] == "worker"

    # Idempotente: un segundo ingreso reusa la MISMA cuenta invitada compartida.
    again = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "worker"}
    )
    assert again.json()["user"]["id"] == body["user"]["id"]


async def test_guest_login_employer_role(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "employer"}
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "employer"


async def test_guest_default_role_is_worker(client: AsyncClient):
    resp = await client.post("/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN})
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "worker"
