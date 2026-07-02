"""Tests de integración del módulo application (postulación a turnos)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"]},
    )
    return headers, profile.json()["id"]


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def _published_shift(client: AsyncClient, employer_headers: dict) -> str:
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    return shift_id


async def test_worker_applies_to_open_shift(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app1@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, worker_id = await _worker_with_profile(client, "w_app1@staffya.com")

    response = await client.post(
        f"/api/v1/applications/shifts/{shift_id}", headers=worker
    )
    assert response.status_code == 201
    body = response.json()
    assert body["shift_id"] == shift_id
    assert body["worker_profile_id"] == worker_id
    assert body["status"] == "pendiente"


async def test_cannot_apply_twice(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app2@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "w_app2@staffya.com")

    first = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert first.status_code == 201
    second = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert second.status_code == 409


async def test_cannot_apply_to_draft_shift(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload()
    )
    shift_id = created.json()["id"]  # sin publicar: queda en borrador
    worker, _ = await _worker_with_profile(client, "w_app3@staffya.com")

    response = await client.post(
        f"/api/v1/applications/shifts/{shift_id}", headers=worker
    )
    assert response.status_code == 404


async def test_employer_only_can_apply_is_forbidden(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app4@staffya.com")
    shift_id = await _published_shift(client, employer)
    # El propio empleador (rol employer) no puede postularse: requiere rol worker.
    response = await client.post(
        f"/api/v1/applications/shifts/{shift_id}", headers=employer
    )
    assert response.status_code == 403


async def test_employer_sees_applicants_enriched(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app5@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, worker_id = await _worker_with_profile(client, "w_app5@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)

    applicants = await client.get(
        f"/api/v1/applications/shifts/{shift_id}", headers=employer
    )
    assert applicants.status_code == 200
    body = applicants.json()
    assert len(body) == 1
    assert body[0]["worker_profile_id"] == worker_id
    assert body[0]["full_name"] == "Test User"
    assert body[0]["status"] == "pendiente"


async def test_other_company_cannot_see_applicants(client: AsyncClient):
    employer_a = await _employer_with_company(client, "emp_app6a@staffya.com")
    shift_id = await _published_shift(client, employer_a)
    worker, _ = await _worker_with_profile(client, "w_app6@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)

    employer_b = await _employer_with_company(client, "emp_app6b@staffya.com")
    response = await client.get(
        f"/api/v1/applications/shifts/{shift_id}", headers=employer_b
    )
    assert response.status_code == 404


async def test_worker_lists_own_applications(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app7@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "w_app7@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)

    mine = await client.get("/api/v1/applications/mine", headers=worker)
    assert mine.status_code == 200
    assert any(a["shift_id"] == shift_id for a in mine.json())


async def test_my_applications_pagination(client: AsyncClient):
    """R2.1: `/applications/mine` pagina con `limit`/`offset`."""
    employer = await _employer_with_company(client, "emp_app_pag@staffya.com")
    worker, _ = await _worker_with_profile(client, "w_app_pag@staffya.com")

    shift_ids = []
    for _ in range(3):
        shift_id = await _published_shift(client, employer)
        await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
        shift_ids.append(shift_id)

    all_mine = await client.get("/api/v1/applications/mine", headers=worker)
    assert len(all_mine.json()) == 3

    page1 = await client.get(
        "/api/v1/applications/mine", headers=worker, params={"limit": 2, "offset": 0}
    )
    assert page1.status_code == 200
    assert len(page1.json()) == 2

    page2 = await client.get(
        "/api/v1/applications/mine", headers=worker, params={"limit": 2, "offset": 2}
    )
    assert len(page2.json()) == 1
    assert {a["id"] for a in page1.json()} | {a["id"] for a in page2.json()} == {
        a["id"] for a in all_mine.json()
    }


async def test_applying_notifies_company(client: AsyncClient):
    employer = await _employer_with_company(client, "emp_app8@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "w_app8@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)

    notifications = await client.get("/api/v1/notifications", headers=employer)
    assert notifications.status_code == 200
    assert any(n["type"] == "new_applicant" for n in notifications.json())
