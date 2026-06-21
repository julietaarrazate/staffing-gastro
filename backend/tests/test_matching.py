"""Tests de integración del módulo matching (top de candidatos)."""

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


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await _auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
    )
    return headers


async def _worker_profile(
    client: AsyncClient, email: str, **overrides
) -> dict:
    headers = await _auth_headers(client, "worker", email)
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

    worker_headers = await _auth_headers(client, "worker", "w5@staffya.com")
    response = await client.get(
        f"/api/v1/shifts/{shift_id}/candidates", headers=worker_headers
    )
    assert response.status_code == 403
