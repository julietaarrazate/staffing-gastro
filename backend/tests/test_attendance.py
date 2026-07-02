"""Tests del flujo de asistencia geolocalizada (en_camino → ... → pagado)."""

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
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def _confirmed_shift(client: AsyncClient, emp_email: str, worker_email: str):
    employer_headers = await _employer_with_company(client, emp_email)
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(client, worker_email)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
    return shift_id, employer_headers, worker_headers


async def test_full_attendance_flow(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp1@staffya.com", "att_w1@staffya.com"
    )

    departed = await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    assert departed.status_code == 200
    assert departed.json()["status"] == "en_camino"

    checked_in = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert checked_in.status_code == 200
    body = checked_in.json()
    assert body["status"] == "check_in"
    assert body["check_in_latitude"] == -34.58
    assert body["check_in_longitude"] == -58.43
    assert body["check_in_at"] is not None

    started = await client.post(
        f"/api/v1/shifts/{shift_id}/start-working", headers=worker_headers
    )
    assert started.status_code == 200
    assert started.json()["status"] == "trabajando"

    checked_out = await client.post(
        f"/api/v1/shifts/{shift_id}/check-out",
        headers=worker_headers,
        json={"latitude": -34.59, "longitude": -58.44},
    )
    assert checked_out.status_code == 200
    body = checked_out.json()
    assert body["status"] == "check_out"
    assert body["check_out_latitude"] == -34.59
    assert body["check_out_at"] is not None

    # El comercio recibe una notificación cuando el trabajador termina.
    notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert any(n["type"] == "shift_checked_out" for n in notifications.json())

    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)
    assert finished.status_code == 200
    assert finished.json()["status"] == "finalizado"

    paid = await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer_headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "pagado"
    assert paid.json()["paid_at"] is not None

    # El trabajador recibe una notificación cuando se le paga.
    worker_notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "shift_paid" for n in worker_notifications.json())


async def test_cannot_check_in_before_departing(client: AsyncClient):
    shift_id, _employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp2@staffya.com", "att_w2@staffya.com"
    )
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert response.status_code == 400


async def test_other_worker_cannot_depart_someone_elses_shift(client: AsyncClient):
    shift_id, _employer_headers, _worker_headers = await _confirmed_shift(
        client, "att_emp3@staffya.com", "att_w3@staffya.com"
    )
    other_headers, _ = await _worker_with_profile(client, "att_w_other@staffya.com")
    response = await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=other_headers)
    assert response.status_code == 404


async def test_employer_cannot_finish_before_check_out(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp4@staffya.com", "att_w4@staffya.com"
    )
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    response = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)
    assert response.status_code == 400
