"""Tests del módulo admin (panel de administración)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository

pytestmark = pytest.mark.asyncio


async def _register(client: AsyncClient, role: str, email: str) -> dict:
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


async def _make_admin(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    email: str,
) -> dict:
    """Registra un usuario y lo promueve a admin directamente en la DB."""
    await _register(client, "employer", email)
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    # Re-login para obtener un token con el rol actualizado en los claims.
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "supersecreta123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_non_admin_cannot_access(client: AsyncClient):
    headers = await _register(client, "worker", "worker@test.com")
    resp = await client.get("/api/v1/admin/users", headers=headers)
    assert resp.status_code == 403


async def test_admin_lists_users_and_stats(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await _register(client, "worker", "w1@test.com")
    await _register(client, "employer", "e1@test.com")

    users = await client.get("/api/v1/admin/users", headers=admin)
    assert users.status_code == 200
    assert len(users.json()) == 3

    stats = await client.get("/api/v1/admin/stats", headers=admin)
    assert stats.status_code == 200
    body = stats.json()
    assert body["total_users"] == 3
    assert body["workers"] == 1
    assert body["employers"] == 1
    assert body["admins"] == 1


async def test_admin_suspends_and_activates_user(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await _register(client, "worker", "target@test.com")

    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "target@test.com")

    suspended = await client.post(f"/api/v1/admin/users/{target_id}/suspend", headers=admin)
    assert suspended.status_code == 200
    assert suspended.json()["status"] == "suspended"

    # El usuario suspendido no puede iniciar sesión.
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "target@test.com", "password": "supersecreta123"},
    )
    assert login.status_code == 403

    activated = await client.post(f"/api/v1/admin/users/{target_id}/activate", headers=admin)
    assert activated.status_code == 200
    assert activated.json()["status"] == "active"


async def test_admin_cannot_suspend_self(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    me = await client.get("/api/v1/auth/me", headers=admin)
    my_id = me.json()["id"]

    resp = await client.post(f"/api/v1/admin/users/{my_id}/suspend", headers=admin)
    assert resp.status_code == 400


async def test_admin_promotes_and_verifies_user(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    await _register(client, "worker", "target@test.com")

    users = await client.get("/api/v1/admin/users", headers=admin)
    target_id = next(u["id"] for u in users.json() if u["email"] == "target@test.com")

    promoted = await client.post(f"/api/v1/admin/users/{target_id}/promote", headers=admin)
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"

    verified = await client.post(f"/api/v1/admin/users/{target_id}/verify", headers=admin)
    assert verified.status_code == 200
    assert verified.json()["is_verified"] is True


async def test_action_on_missing_user_returns_404(client, session_factory):
    admin = await _make_admin(client, session_factory, "admin@test.com")
    missing = "00000000-0000-0000-0000-000000000000"
    resp = await client.post(f"/api/v1/admin/users/{missing}/activate", headers=admin)
    assert resp.status_code == 404
