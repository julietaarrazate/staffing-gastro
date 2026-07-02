"""Tests de integración del módulo shift (publicación y ciclo de vida del turno)."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    """Empleador con perfil de comercio listo para publicar turnos."""
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 2,
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


async def test_employer_creates_shift_as_draft(client: AsyncClient):
    headers = await _employer_with_company(client, "emp1@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    assert response.status_code == 201
    body = response.json()
    assert body["position"] == "mozo"
    assert body["quantity"] == 2
    assert float(body["pay_amount"]) == 70000.0
    assert body["status"] == "borrador"
    assert body["urgent"] is True


async def test_employer_without_company_cannot_publish(client: AsyncClient):
    headers = await auth_headers(client, "employer", "emp_nc@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    assert response.status_code == 400


async def test_worker_cannot_create_shift(client: AsyncClient):
    headers = await auth_headers(client, "worker", "mozo_s@staffya.com")
    response = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    assert response.status_code == 403


async def test_invalid_schedule_rejected(client: AsyncClient):
    headers = await _employer_with_company(client, "emp2@staffya.com")
    response = await client.post(
        "/api/v1/shifts",
        headers=headers,
        json=_shift_payload(
            start_at="2026-06-28T20:00:00", end_at="2026-06-28T19:00:00"
        ),
    )
    assert response.status_code == 400


async def test_publish_flow_and_feed(client: AsyncClient):
    headers = await _employer_with_company(client, "emp3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]

    # En borrador todavía no aparece en el feed.
    feed_before = await client.get("/api/v1/shifts/feed", headers=headers)
    assert all(s["id"] != shift_id for s in feed_before.json())

    published = await client.post(
        f"/api/v1/shifts/{shift_id}/publish", headers=headers
    )
    assert published.status_code == 200
    assert published.json()["status"] == "publicado"

    # Ahora sí aparece en el feed.
    feed_after = await client.get("/api/v1/shifts/feed", headers=headers)
    assert any(s["id"] == shift_id for s in feed_after.json())


async def test_cannot_publish_twice(client: AsyncClient):
    headers = await _employer_with_company(client, "emp4@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    second = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    assert second.status_code == 400


async def test_cancel_shift(client: AsyncClient):
    headers = await _employer_with_company(client, "emp5@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelado"


async def test_cannot_edit_after_cancel(client: AsyncClient):
    headers = await _employer_with_company(client, "emp6@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)
    update = await client.put(
        f"/api/v1/shifts/{shift_id}",
        headers=headers,
        json=_shift_payload(quantity=5),
    )
    assert update.status_code == 400


async def test_other_company_cannot_see_or_touch_shift(client: AsyncClient):
    headers_a = await _employer_with_company(client, "empA@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=headers_a, json=_shift_payload()
    )
    shift_id = created.json()["id"]

    headers_b = await _employer_with_company(client, "empB@staffya.com")
    # No aparece en "mis turnos" del otro comercio.
    mine_b = await client.get("/api/v1/shifts/me", headers=headers_b)
    assert all(s["id"] != shift_id for s in mine_b.json())
    # Y no puede cancelarlo.
    cancel_b = await client.post(
        f"/api/v1/shifts/{shift_id}/cancel", headers=headers_b
    )
    assert cancel_b.status_code == 404


async def test_feed_filters_by_position(client: AsyncClient):
    headers = await _employer_with_company(client, "emp7@staffya.com")
    for position in ("mozo", "bartender"):
        created = await client.post(
            "/api/v1/shifts", headers=headers, json=_shift_payload(position=position)
        )
        await client.post(
            f"/api/v1/shifts/{created.json()['id']}/publish", headers=headers
        )

    feed = await client.get(
        "/api/v1/shifts/feed", headers=headers, params={"position": "bartender"}
    )
    assert feed.status_code == 200
    positions = {s["position"] for s in feed.json()}
    assert positions == {"bartender"}


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"]},
    )
    return headers, profile.json()["id"]


async def test_assign_confirm_flow(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp8@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_assign@staffya.com"
    )
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "asignado"
    assert assigned.json()["worker_profile_id"] == worker_profile_id

    confirmed = await client.post(
        f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmado"


async def test_reject_assignment_reopens_search(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp9@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_reject@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    rejected = await client.post(
        f"/api/v1/shifts/{shift_id}/reject", headers=worker_headers
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "buscando_personal"
    assert rejected.json()["worker_profile_id"] is None


async def test_worker_sees_assigned_shifts_in_mine(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "emp11@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "w_mine@staffya.com"
    )

    mine_before = await client.get("/api/v1/shifts/mine", headers=worker_headers)
    assert mine_before.json() == []

    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    mine_after = await client.get("/api/v1/shifts/mine", headers=worker_headers)
    assert any(s["id"] == shift_id for s in mine_after.json())


async def test_other_worker_cannot_confirm_someone_elses_assignment(
    client: AsyncClient,
):
    employer_headers = await _employer_with_company(client, "emp10@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    _assigned_headers, worker_profile_id = await _worker_with_profile(
        client, "w_owner@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    other_headers, _ = await _worker_with_profile(client, "w_other@staffya.com")
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/confirm", headers=other_headers
    )
    assert response.status_code == 404
