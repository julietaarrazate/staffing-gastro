"""Tests de "Personas" del panel de admin: buscador, filtros y ficha."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from tests.conftest import auth_headers, login

pytestmark = pytest.mark.asyncio

PALERMO = {"latitude": -34.58, "longitude": -58.43}


async def _make_admin(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    email: str,
) -> dict:
    await auth_headers(client, "employer", email, full_name="Admin Prueba")
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _user_id(session_factory, email: str) -> str:
    async with session_factory() as session:
        user = await SqlAlchemyUserRepository(session).get_by_email(email)
        return str(user.id)


async def _people(client, session_factory) -> dict:
    admin = await _make_admin(client, session_factory, "personas_admin@staffya.com")
    worker = await auth_headers(client, "worker", "ana.mozo@staffya.com", full_name="Ana Mozo")
    await client.post(
        "/api/v1/workers/me/profile",
        headers=worker,
        json={"skills": ["mozo"], "city": "Palermo", "years_experience": 3, **PALERMO},
    )
    employer = await auth_headers(
        client, "employer", "bodegon@staffya.com", full_name="Pepe Bodegón"
    )
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer,
        json={"name": "Bodegón Don Pepe", "city": "Palermo", **PALERMO},
    )
    await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "general", "subject": "No me llegan avisos", "body": "Desde ayer."},
    )
    return {"admin": admin, "worker": worker, "employer": employer}


async def test_search_by_name_or_email_case_insensitive(client, session_factory):
    p = await _people(client, session_factory)

    by_name = await client.get("/api/v1/admin/users?q=ana%20MOZO", headers=p["admin"])
    assert by_name.status_code == 200
    assert [u["email"] for u in by_name.json()] == ["ana.mozo@staffya.com"]

    by_email = await client.get("/api/v1/admin/users?q=BODEGON@", headers=p["admin"])
    assert [u["full_name"] for u in by_email.json()] == ["Pepe Bodegón"]

    # `%` no es comodín: no trae a todos.
    wildcard = await client.get("/api/v1/admin/users?q=%25", headers=p["admin"])
    assert wildcard.json() == []


async def test_filters_by_role_status_and_verified(client, session_factory):
    p = await _people(client, session_factory)
    worker_id = await _user_id(session_factory, "ana.mozo@staffya.com")

    workers = await client.get("/api/v1/admin/users?role=worker", headers=p["admin"])
    assert [u["email"] for u in workers.json()] == ["ana.mozo@staffya.com"]

    await client.post(f"/api/v1/admin/users/{worker_id}/suspend", headers=p["admin"])
    suspended = await client.get("/api/v1/admin/users?status=suspended", headers=p["admin"])
    assert [u["email"] for u in suspended.json()] == ["ana.mozo@staffya.com"]

    await client.post(f"/api/v1/admin/users/{worker_id}/verify", headers=p["admin"])
    unverified = await client.get(
        "/api/v1/admin/users?verified=false&role=worker", headers=p["admin"]
    )
    assert unverified.json() == []


async def test_worker_detail_has_profile_and_tickets(client, session_factory):
    p = await _people(client, session_factory)
    worker_id = await _user_id(session_factory, "ana.mozo@staffya.com")

    res = await client.get(f"/api/v1/admin/users/{worker_id}", headers=p["admin"])
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["full_name"] == "Ana Mozo"
    assert body["worker"]["skills"] == ["mozo"]
    assert body["worker"]["years_experience"] == 3
    assert body["worker"]["no_shows"] == 0
    assert body["company"] is None
    assert body["recent_shifts"] == []
    assert [t["subject"] for t in body["tickets"]] == ["No me llegan avisos"]
    assert body["tickets"][0]["status"] == "abierto"


async def test_company_detail_has_company_summary(client, session_factory):
    p = await _people(client, session_factory)
    employer_id = await _user_id(session_factory, "bodegon@staffya.com")

    body = (await client.get(f"/api/v1/admin/users/{employer_id}", headers=p["admin"])).json()
    assert body["company"]["name"] == "Bodegón Don Pepe"
    assert body["worker"] is None
    assert body["tickets"] == []


async def test_detail_of_unknown_user_is_404(client, session_factory):
    admin = await _make_admin(client, session_factory, "personas_admin2@staffya.com")
    res = await client.get(
        "/api/v1/admin/users/00000000-0000-0000-0000-000000000000", headers=admin
    )
    assert res.status_code == 404


async def test_non_admin_cannot_see_people(client, session_factory):
    p = await _people(client, session_factory)
    worker_id = await _user_id(session_factory, "ana.mozo@staffya.com")
    assert (await client.get("/api/v1/admin/users?q=ana", headers=p["employer"])).status_code == 403
    res = await client.get(f"/api/v1/admin/users/{worker_id}", headers=p["employer"])
    assert res.status_code == 403
