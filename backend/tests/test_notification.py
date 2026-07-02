"""Tests del módulo notification y su integración con el ciclo de vida de turnos."""

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
        "tips": True,
        "dress_code": "Camisa negra",
        "urgent": True,
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def test_no_notifications_initially(client: AsyncClient):
    headers = await auth_headers(client, "worker", "n1@staffya.com")
    response = await client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


async def test_mark_unknown_notification_as_read_returns_404(client: AsyncClient):
    headers = await auth_headers(client, "worker", "n2@staffya.com")
    response = await client.post(
        "/api/v1/notifications/00000000-0000-0000-0000-000000000000/read",
        headers=headers,
    )
    assert response.status_code == 404


async def test_assign_notifies_worker(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "n_emp1@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "n_worker1@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert notifications.status_code == 200
    body = notifications.json()
    assert len(body) == 1
    assert body[0]["type"] == "shift_assigned"
    assert body[0]["read"] is False

    mark_read = await client.post(
        f"/api/v1/notifications/{body[0]['id']}/read", headers=worker_headers
    )
    assert mark_read.status_code == 200
    assert mark_read.json()["read"] is True


async def test_confirm_notifies_company(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "n_emp2@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "n_worker2@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)

    notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert notifications.status_code == 200
    body = notifications.json()
    assert len(body) == 1
    assert body[0]["type"] == "shift_confirmed"


async def test_reject_notifies_company(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "n_emp3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "n_worker3@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=worker_headers)

    notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert notifications.status_code == 200
    body = notifications.json()
    assert len(body) == 1
    assert body[0]["type"] == "shift_rejected"


async def test_cannot_mark_someone_elses_notification_as_read(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "n_emp4@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "n_worker4@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    notification_id = notifications.json()[0]["id"]

    other_headers = await auth_headers(client, "worker", "n_other@staffya.com")
    response = await client.post(
        f"/api/v1/notifications/{notification_id}/read", headers=other_headers
    )
    assert response.status_code == 404
