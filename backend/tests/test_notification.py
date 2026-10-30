"""Tests del módulo notification y su integración con el ciclo de vida de turnos."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_admin


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


@pytest.mark.asyncio
async def test_no_notifications_initially(client: AsyncClient):
    headers = await auth_headers(client, "worker", "n1@staffya.com")
    response = await client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_mark_unknown_notification_as_read_returns_404(client: AsyncClient):
    headers = await auth_headers(client, "worker", "n2@staffya.com")
    response = await client.post(
        "/api/v1/notifications/00000000-0000-0000-0000-000000000000/read",
        headers=headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_notifications_pagination(client: AsyncClient):
    """R2.1: `/notifications` pagina con `limit`/`offset`."""
    employer_headers = await _employer_with_company(client, "n_pag_emp@staffya.com")
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "n_pag_worker@staffya.com"
    )

    shift_ids = []
    for _ in range(3):
        created = await client.post(
            "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
        )
        shift_id = created.json()["id"]
        await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
        await client.post(
            f"/api/v1/shifts/{shift_id}/assign",
            headers=employer_headers,
            json={"worker_profile_id": worker_profile_id},
        )
        shift_ids.append(shift_id)

    all_notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    todas = all_notifications.json()
    # Cada turno le genera DOS avisos al trabajador: el de "turno nuevo cerca
    # tuyo" al publicarse y el de "te asignaron" al asignárselo.
    assert len(todas) == 6
    assert len([n for n in todas if n["type"] == "new_shift_nearby"]) == 3
    assert len([n for n in todas if n["type"] == "shift_assigned"]) == 3

    limited = await client.get(
        "/api/v1/notifications", headers=worker_headers, params={"limit": 1, "offset": 0}
    )
    assert limited.status_code == 200
    assert len(limited.json()) == 1

    rest = await client.get(
        "/api/v1/notifications", headers=worker_headers, params={"limit": 5, "offset": 1}
    )
    assert len(rest.json()) == 5
    # Paginar no pierde ni duplica: las dos páginas reconstruyen el total.
    assert {n["id"] for n in limited.json()} | {n["id"] for n in rest.json()} == {
        n["id"] for n in todas
    }


@pytest.mark.asyncio
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


def test_notifications_websocket_closes_after_too_many_frames():
    """TECH_DEBT.md S2: mismo tope que el WS de chat — antes no había límite
    sobre cuántos frames podía mandar el cliente por esta conexión (el
    servidor los descarta, es un canal push-only, pero cada uno igual
    entraba al loop sin parar)."""
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    from app.core.config import settings
    from app.core.rate_limit import reset_all_rate_limiters
    from app.main import app
    from tests.test_chat import _setup_in_memory_db

    _setup_in_memory_db()
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()

    try:
        with TestClient(app) as client:
            register = client.post(
                "/api/v1/auth/register",
                json={
                    "email": "ws_notif_flood@staffya.com",
                    "password": "supersecreta123",
                    "full_name": "Worker Flood",
                    "role": "worker",
                    "accepted_terms": True,
                },
            )
            assert register.status_code == 201
            login = client.post(
                "/api/v1/auth/login",
                json={"email": "ws_notif_flood@staffya.com", "password": "supersecreta123"},
            )
            token = login.json()["access_token"]

            with client.websocket_connect(f"/api/v1/notifications/ws?token={token}") as ws:
                for _ in range(120):
                    ws.send_text("ping")
                ws.send_text("ping")
                with pytest.raises(WebSocketDisconnect):
                    ws.receive_text()
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_mark_all_read_marks_only_my_unread(client: AsyncClient):
    """La campanita quedaba en "9+" para siempre: cada aviso se marcaba
    leído de a uno (pedido de Julieta, 2026-10-30). `read-all` los marca
    todos en un solo UPDATE y no toca los de otra persona."""
    employer_headers = await _employer_with_company(client, "n_all_emp@staffya.com")
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "n_all_worker@staffya.com"
    )
    other_headers, _ = await _worker_with_profile(client, "n_all_other@staffya.com")

    for _ in range(2):
        created = await client.post(
            "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
        )
        shift_id = created.json()["id"]
        await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    mine = (await client.get("/api/v1/notifications", headers=worker_headers)).json()
    assert len(mine) == 3  # dos "turno cerca" + "te asignaron"
    # Uno ya leído de antes: no se cuenta de nuevo.
    await client.post(f"/api/v1/notifications/{mine[0]['id']}/read", headers=worker_headers)

    response = await client.post("/api/v1/notifications/read-all", headers=worker_headers)
    assert response.status_code == 200
    assert response.json() == {"marked": 2}

    after = (await client.get("/api/v1/notifications", headers=worker_headers)).json()
    assert len(after) == 3
    assert all(n["read"] for n in after)

    others = (await client.get("/api/v1/notifications", headers=other_headers)).json()
    assert len(others) == 2
    assert not any(n["read"] for n in others)

    again = await client.post("/api/v1/notifications/read-all", headers=worker_headers)
    assert again.json() == {"marked": 0}


@pytest.mark.asyncio
async def test_mark_all_read_requires_session(client: AsyncClient):
    response = await client.post("/api/v1/notifications/read-all")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_can_mark_all_read(client: AsyncClient, session_factory):
    """La cuenta de Julieta es admin: con la verificación en dos pasos hecha,
    el botón le funciona (aunque no tenga nada sin leer)."""
    admin_headers = await make_admin(client, session_factory, "n_all_admin@staffya.com")
    response = await client.post("/api/v1/notifications/read-all", headers=admin_headers)
    assert response.status_code == 200
    assert response.json() == {"marked": 0}
