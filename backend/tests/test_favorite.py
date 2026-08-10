"""Tests de integración del módulo favorite (comercio marca trabajadores)."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

PALERMO = {"latitude": -34.58, "longitude": -58.43}


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", **PALERMO},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"], **PALERMO},
    )
    return headers, profile.json()["id"]


async def test_mark_and_list_favorite(client: AsyncClient):
    employer = await _employer_with_company(client, "fav_emp1@staffya.com")
    _worker, worker_id = await _worker_with_profile(client, "fav_w1@staffya.com")

    marked = await client.put(f"/api/v1/favorites/{worker_id}", headers=employer)
    assert marked.status_code == 200
    assert marked.json()["is_favorite"] is True

    listed = await client.get("/api/v1/favorites", headers=employer)
    assert listed.status_code == 200
    body = listed.json()
    assert len(body) == 1
    assert body[0]["worker_profile_id"] == worker_id
    assert body[0]["full_name"] == "Test User"
    assert body[0]["shifts_together"] == 0


async def test_mark_is_idempotent(client: AsyncClient):
    employer = await _employer_with_company(client, "fav_emp2@staffya.com")
    _worker, worker_id = await _worker_with_profile(client, "fav_w2@staffya.com")

    await client.put(f"/api/v1/favorites/{worker_id}", headers=employer)
    second = await client.put(f"/api/v1/favorites/{worker_id}", headers=employer)
    assert second.status_code == 200

    listed = await client.get("/api/v1/favorites", headers=employer)
    assert len(listed.json()) == 1


async def test_unmark_removes_favorite_and_is_idempotent(client: AsyncClient):
    employer = await _employer_with_company(client, "fav_emp3@staffya.com")
    _worker, worker_id = await _worker_with_profile(client, "fav_w3@staffya.com")

    await client.put(f"/api/v1/favorites/{worker_id}", headers=employer)
    removed = await client.delete(f"/api/v1/favorites/{worker_id}", headers=employer)
    assert removed.status_code == 200
    assert removed.json()["is_favorite"] is False

    listed = await client.get("/api/v1/favorites", headers=employer)
    assert listed.json() == []

    # Desmarcar de nuevo (ya no existe) no falla: idempotente.
    again = await client.delete(f"/api/v1/favorites/{worker_id}", headers=employer)
    assert again.status_code == 200


async def test_favorite_status_endpoint(client: AsyncClient):
    employer = await _employer_with_company(client, "fav_emp4@staffya.com")
    _worker, worker_id = await _worker_with_profile(client, "fav_w4@staffya.com")

    before = await client.get(f"/api/v1/favorites/{worker_id}/status", headers=employer)
    assert before.json()["is_favorite"] is False

    await client.put(f"/api/v1/favorites/{worker_id}", headers=employer)
    after = await client.get(f"/api/v1/favorites/{worker_id}/status", headers=employer)
    assert after.json()["is_favorite"] is True


async def test_favorites_are_private_per_company(client: AsyncClient):
    employer_a = await _employer_with_company(client, "fav_emp5a@staffya.com")
    employer_b = await _employer_with_company(client, "fav_emp5b@staffya.com")
    _worker, worker_id = await _worker_with_profile(client, "fav_w5@staffya.com")

    await client.put(f"/api/v1/favorites/{worker_id}", headers=employer_a)

    listed_b = await client.get("/api/v1/favorites", headers=employer_b)
    assert listed_b.json() == []
    status_b = await client.get(f"/api/v1/favorites/{worker_id}/status", headers=employer_b)
    assert status_b.json()["is_favorite"] is False


async def test_mark_nonexistent_worker_returns_404(client: AsyncClient):
    employer = await _employer_with_company(client, "fav_emp6@staffya.com")
    fake_worker_id = "00000000-0000-0000-0000-000000000000"

    response = await client.put(f"/api/v1/favorites/{fake_worker_id}", headers=employer)
    assert response.status_code == 404


async def test_worker_role_cannot_access_favorites(client: AsyncClient):
    worker, worker_id = await _worker_with_profile(client, "fav_w7@staffya.com")

    response = await client.get("/api/v1/favorites", headers=worker)
    assert response.status_code == 403

    response = await client.put(f"/api/v1/favorites/{worker_id}", headers=worker)
    assert response.status_code == 403


async def test_shifts_together_counts_only_completed_shifts(client: AsyncClient):
    """`shifts_together` cuenta turnos FINALIZADO/PAGADO entre ESE comercio y ESE
    trabajador — no postulaciones abiertas ni turnos con otro comercio."""
    employer = await _employer_with_company(client, "fav_emp8@staffya.com")
    worker, worker_id = await _worker_with_profile(client, "fav_w8@staffya.com")

    now = _now_naive()
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(hours=5)).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
            **PALERMO,
        },
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=worker, json=PALERMO)
    await client.post(f"/api/v1/shifts/{shift_id}/start-working", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    assert finished.status_code == 200

    await client.put(f"/api/v1/favorites/{worker_id}", headers=employer)

    listed = await client.get("/api/v1/favorites", headers=employer)
    body = listed.json()
    assert len(body) == 1
    assert body[0]["shifts_together"] == 1
