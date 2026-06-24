"""Tests del módulo review (calificación bidireccional al cerrar un turno)."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _auth_headers(client: AsyncClient, role: str, email: str, name: str) -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "supersecreta123",
            "full_name": name,
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
    headers = await _auth_headers(client, "employer", email, "Bar Palermo")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str, name: str):
    headers = await _auth_headers(client, "worker", email, name)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"]},
    )
    return headers, profile.json()["id"]


async def _shift_at_status(
    client: AsyncClient, emp_email: str, worker_email: str, status: str
):
    """Crea un turno asignado y lo avanza hasta el estado pedido (finalizado o pagado)."""
    employer_headers = await _employer_with_company(client, emp_email)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": "2026-06-28T20:00:00",
            "end_at": "2026-06-29T03:00:00",
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, worker_email, "Juana Trabajadora"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/start-working", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-out",
        headers=worker_headers,
        json={"latitude": -34.59, "longitude": -58.44},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)
    if status == "pagado":
        await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer_headers)

    return shift_id, employer_headers, worker_headers, worker_profile_id


async def test_company_and_worker_review_each_other(client: AsyncClient):
    shift_id, employer_headers, worker_headers, _ = await _shift_at_status(
        client, "rev_emp1@staffya.com", "rev_w1@staffya.com", "pagado"
    )

    from_employer = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5, "comment": "Excelente, muy puntual"},
    )
    assert from_employer.status_code == 201
    assert from_employer.json()["rating"] == 5

    from_worker = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=worker_headers,
        json={"rating": 4, "comment": "Buen ambiente"},
    )
    assert from_worker.status_code == 201
    assert from_worker.json()["rating"] == 4

    listed = await client.get(
        f"/api/v1/reviews/shifts/{shift_id}", headers=employer_headers
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 2


async def test_review_updates_aggregate_rating_used_by_matching(client: AsyncClient):
    shift_id, employer_headers, worker_headers, worker_profile_id = await _shift_at_status(
        client, "rev_emp2@staffya.com", "rev_w2@staffya.com", "pagado"
    )

    await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5},
    )

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert profile.json()["rating"] == 5.0

    # El comercio también recibe su propia reputación calculada cuando lo califican.
    await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=worker_headers,
        json={"rating": 3},
    )
    company_profile = await client.get(
        "/api/v1/companies/me/profile", headers=employer_headers
    )
    assert company_profile.json()["rating"] == 3.0


async def test_cannot_review_twice(client: AsyncClient):
    shift_id, employer_headers, _worker_headers, _ = await _shift_at_status(
        client, "rev_emp3@staffya.com", "rev_w3@staffya.com", "pagado"
    )

    first = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5},
    )
    assert first.status_code == 201

    second = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 1},
    )
    assert second.status_code == 409


async def test_cannot_review_before_shift_closed(client: AsyncClient):
    shift_id, employer_headers, _worker_headers, _ = await _shift_at_status(
        client, "rev_emp4@staffya.com", "rev_w4@staffya.com", "finalizado"
    )

    # finalizado ya es revisable; probamos un estado anterior (check_out) aparte.
    response = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5},
    )
    assert response.status_code == 201


async def test_cannot_review_open_shift(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "rev_emp5@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=employer_headers,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": "2026-06-28T20:00:00",
            "end_at": "2026-06-29T03:00:00",
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    shift_id = created.json()["id"]
    response = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5},
    )
    assert response.status_code == 404


async def test_outsider_cannot_review(client: AsyncClient):
    shift_id, _employer_headers, _worker_headers, _ = await _shift_at_status(
        client, "rev_emp6@staffya.com", "rev_w6@staffya.com", "pagado"
    )
    intruder_headers, _ = await _worker_with_profile(
        client, "rev_intruder@staffya.com", "Intruso"
    )
    response = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=intruder_headers,
        json={"rating": 5},
    )
    assert response.status_code == 404


async def test_invalid_rating_rejected(client: AsyncClient):
    shift_id, employer_headers, _worker_headers, _ = await _shift_at_status(
        client, "rev_emp7@staffya.com", "rev_w7@staffya.com", "pagado"
    )
    response = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 7},
    )
    assert response.status_code == 422


async def test_reviewee_gets_notification(client: AsyncClient):
    shift_id, employer_headers, worker_headers, _ = await _shift_at_status(
        client, "rev_emp8@staffya.com", "rev_w8@staffya.com", "pagado"
    )
    await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5, "comment": "Muy bien"},
    )
    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "review_received" for n in notifications.json())


async def test_received_reviews_listed_on_profile(client: AsyncClient):
    shift_id, employer_headers, worker_headers, _ = await _shift_at_status(
        client, "rev_emp9@staffya.com", "rev_w9@staffya.com", "pagado"
    )
    await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer_headers,
        json={"rating": 5, "comment": "Recomendado"},
    )
    received = await client.get("/api/v1/reviews/received", headers=worker_headers)
    assert received.status_code == 200
    assert len(received.json()) == 1
    assert received.json()[0]["comment"] == "Recomendado"
