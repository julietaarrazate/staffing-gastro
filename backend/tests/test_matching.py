"""Tests de integración del módulo matching (top de candidatos)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from tests.conftest import auth_headers, login

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
    )
    return headers


async def _worker_profile(
    client: AsyncClient, email: str, **overrides
) -> dict:
    headers = await auth_headers(client, "worker", email)
    payload = {
        "skills": ["mozo"],
        "years_experience": 2,
        "is_available": True,
        "latitude": -34.58,
        "longitude": -58.43,
    }
    payload.update(overrides)
    await client.post("/api/v1/workers/me/profile", headers=headers, json=payload)
    return headers


async def _publish_shift(client: AsyncClient, headers: dict, **overrides) -> str:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "latitude": -34.58,
        "longitude": -58.43,
    }
    payload.update(overrides)
    created = await client.post("/api/v1/shifts", headers=headers, json=payload)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    return shift_id


async def test_only_eligible_candidates_appear(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp1@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    eligible_headers = await _worker_profile(client, "w1@staffya.com")
    await _worker_profile(client, "w2@staffya.com", skills=["bartender"])
    await _worker_profile(client, "w3@staffya.com", is_available=False)

    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert response.status_code == 200
    candidates = response.json()
    assert len(candidates) == 1

    me = await client.get("/api/v1/workers/me/profile", headers=eligible_headers)
    assert candidates[0]["profile_id"] == me.json()["id"]


async def test_ranking_orders_by_score_desc(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp2@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    await _worker_profile(client, "near@staffya.com", years_experience=10)
    await _worker_profile(
        client, "far@staffya.com", years_experience=0, latitude=-31.4, longitude=-64.2
    )

    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=employer_headers
    )
    assert response.status_code == 200
    candidates = response.json()
    assert len(candidates) == 2
    assert candidates[0]["score"] > candidates[1]["score"]
    assert candidates[0]["distance_km"] < candidates[1]["distance_km"]


async def test_other_company_cannot_see_candidates(client: AsyncClient):
    headers_a = await _employer_with_company(client, "empA@staffya.com")
    shift_id = await _publish_shift(client, headers_a)
    await _worker_profile(client, "w4@staffya.com")

    headers_b = await _employer_with_company(client, "empB@staffya.com")
    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=headers_b
    )
    assert response.status_code == 404


async def test_worker_cannot_request_candidates(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp3@staffya.com")
    shift_id = await _publish_shift(client, employer_headers)

    worker_headers = await auth_headers(client, "worker", "w5@staffya.com")
    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=worker_headers
    )
    assert response.status_code == 403


async def test_search_workers_filters_by_skill_and_radius(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp4@staffya.com")
    await _worker_profile(client, "near_mozo@staffya.com", skills=["mozo"])
    await _worker_profile(
        client,
        "far_mozo@staffya.com",
        skills=["mozo"],
        latitude=-31.4,
        longitude=-64.2,
    )
    await _worker_profile(client, "near_bartender@staffya.com", skills=["bartender"])

    response = await client.get(
        "/api/v1/matching/search",
        headers=employer_headers,
        params={
            "skill": "mozo",
            "latitude": -34.58,
            "longitude": -58.43,
            "radius_km": 25,
        },
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["distance_km"] < 1


async def test_search_workers_without_filters_returns_all_available(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp5@staffya.com")
    await _worker_profile(client, "any1@staffya.com", skills=["mozo"])
    await _worker_profile(client, "any2@staffya.com", skills=["bartender"])

    response = await client.get("/api/v1/matching/search", headers=employer_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_worker_cannot_search_map(client: AsyncClient):
    worker_headers = await auth_headers(client, "worker", "w6@staffya.com")
    response = await client.get("/api/v1/matching/search", headers=worker_headers)
    assert response.status_code == 403


async def test_admin_can_search_map_read_only(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """El admin explora el mapa de trabajadores en modo sólo-lectura, sin
    tener que impersonar a nadie puntual (pedido real de Julieta, "Ver como"
    de PR #165 no alcanzaba para esto)."""
    await _worker_profile(client, "any3@staffya.com", skills=["mozo"])

    await auth_headers(client, "employer", "admin_search@staffya.com")
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email("admin_search@staffya.com")
        user.promote_to_admin()
        await repo.update(user)
    tokens = await login(client, "admin_search@staffya.com")
    admin_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.get("/api/v1/matching/search", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
