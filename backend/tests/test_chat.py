"""Tests del módulo chat (conversación trabajador ↔ comercio por turno)."""

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.websockets import WebSocketDisconnect

from app.core.database import Base, get_session
from app.main import app
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Bar Palermo")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str, name: str):
    headers = await auth_headers(client, "worker", email, name)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"]},
    )
    return headers, profile.json()["id"]


async def _assigned_shift(client: AsyncClient, emp_email: str, worker_email: str):
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
    return shift_id, employer_headers, worker_headers


async def test_send_and_read_messages(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _assigned_shift(
        client, "chat_emp1@staffya.com", "chat_w1@staffya.com"
    )

    sent = await client.post(
        f"/api/v1/chats/{shift_id}/messages",
        headers=employer_headers,
        json={"body": "Hola! ¿Confirmás que venís?"},
    )
    assert sent.status_code == 201
    assert sent.json()["body"] == "Hola! ¿Confirmás que venís?"

    reply = await client.post(
        f"/api/v1/chats/{shift_id}/messages",
        headers=worker_headers,
        json={"body": "Sí, ahí voy"},
    )
    assert reply.status_code == 201

    messages = await client.get(
        f"/api/v1/chats/{shift_id}/messages", headers=worker_headers
    )
    assert messages.status_code == 200
    bodies = [m["body"] for m in messages.json()]
    assert bodies == ["Hola! ¿Confirmás que venís?", "Sí, ahí voy"]


async def test_recipient_gets_notification(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _assigned_shift(
        client, "chat_emp2@staffya.com", "chat_w2@staffya.com"
    )
    await client.post(
        f"/api/v1/chats/{shift_id}/messages",
        headers=employer_headers,
        json={"body": "Traé tu uniforme negro"},
    )
    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "chat_message" for n in notifications.json())


async def test_inbox_lists_conversation_with_unread_count(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _assigned_shift(
        client, "chat_emp3@staffya.com", "chat_w3@staffya.com"
    )
    await client.post(
        f"/api/v1/chats/{shift_id}/messages",
        headers=employer_headers,
        json={"body": "¿Llegás en horario?"},
    )

    inbox = await client.get("/api/v1/chats", headers=worker_headers)
    assert inbox.status_code == 200
    convos = inbox.json()
    assert len(convos) == 1
    assert convos[0]["shift_id"] == shift_id
    assert convos[0]["other_party_name"] == "Bar Palermo"
    assert convos[0]["last_message"] == "¿Llegás en horario?"
    assert convos[0]["unread_count"] == 1

    # Al abrir la conversación, los mensajes recibidos quedan leídos.
    await client.get(f"/api/v1/chats/{shift_id}/messages", headers=worker_headers)
    inbox_after = await client.get("/api/v1/chats", headers=worker_headers)
    assert inbox_after.json()[0]["unread_count"] == 0


async def test_inbox_with_multiple_conversations_both_sides(client: AsyncClient):
    """Cubre la query agregada del inbox (P1) con más de una conversación: un
    comercio con turno propio y, por separado, un trabajador viendo su propio
    inbox — ambos armados con la consulta JOIN + batch, sin loop de queries."""
    shift_id_1, employer_headers_1, worker_headers_1 = await _assigned_shift(
        client, "chat_multi_emp1@staffya.com", "chat_multi_w1@staffya.com"
    )
    shift_id_2, _employer_headers_2, worker_headers_2 = await _assigned_shift(
        client, "chat_multi_emp2@staffya.com", "chat_multi_w2@staffya.com"
    )

    await client.post(
        f"/api/v1/chats/{shift_id_1}/messages",
        headers=worker_headers_1,
        json={"body": "Primer mensaje"},
    )
    await client.post(
        f"/api/v1/chats/{shift_id_2}/messages",
        headers=worker_headers_2,
        json={"body": "Segundo mensaje, más reciente"},
    )

    # Son dos comercios distintos (uno por turno armado por
    # `_assigned_shift`), así que el comercio del turno 1 sólo ve esa
    # conversación.
    inbox_1 = await client.get("/api/v1/chats", headers=employer_headers_1)
    assert inbox_1.status_code == 200
    convos_1 = inbox_1.json()
    assert len(convos_1) == 1
    assert convos_1[0]["shift_id"] == shift_id_1
    assert convos_1[0]["other_party_name"] == "Juana Trabajadora"
    assert convos_1[0]["last_message"] == "Primer mensaje"

    # El trabajador del turno 2 ve su propia conversación con el nombre del
    # comercio como contraparte.
    inbox_worker_2 = await client.get("/api/v1/chats", headers=worker_headers_2)
    assert inbox_worker_2.status_code == 200
    convos_w2 = inbox_worker_2.json()
    assert len(convos_w2) == 1
    assert convos_w2[0]["shift_id"] == shift_id_2
    assert convos_w2[0]["other_party_name"] == "Bar Palermo"
    assert convos_w2[0]["last_message"] == "Segundo mensaje, más reciente"


async def test_outsider_cannot_access_conversation(client: AsyncClient):
    shift_id, _employer_headers, _worker_headers = await _assigned_shift(
        client, "chat_emp4@staffya.com", "chat_w4@staffya.com"
    )
    intruder_headers, _ = await _worker_with_profile(
        client, "chat_intruder@staffya.com", "Intruso"
    )
    response = await client.get(
        f"/api/v1/chats/{shift_id}/messages", headers=intruder_headers
    )
    assert response.status_code == 404

    send = await client.post(
        f"/api/v1/chats/{shift_id}/messages",
        headers=intruder_headers,
        json={"body": "déjenme entrar"},
    )
    assert send.status_code == 404


def test_chat_websocket_pushes_new_messages():
    """El websocket de la conversación entrega en vivo el mensaje que llega por HTTP."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def _create_schema() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def override_get_session():
        async with factory() as session:
            yield session

    import asyncio

    asyncio.get_event_loop().run_until_complete(_create_schema())
    app.dependency_overrides[get_session] = override_get_session

    try:
        with TestClient(app) as client:
            employer = client.post(
                "/api/v1/auth/register",
                json={
                    "email": "ws_emp@staffya.com",
                    "password": "supersecreta123",
                    "full_name": "Bar WS",
                    "role": "employer",
                },
            )
            assert employer.status_code == 201
            employer_login = client.post(
                "/api/v1/auth/login",
                json={"email": "ws_emp@staffya.com", "password": "supersecreta123"},
            )
            employer_token = employer_login.json()["access_token"]
            employer_headers = {"Authorization": f"Bearer {employer_token}"}
            client.post(
                "/api/v1/companies/me/profile",
                headers=employer_headers,
                json={"name": "Bar WS", "city": "Palermo"},
            )

            worker_register = client.post(
                "/api/v1/auth/register",
                json={
                    "email": "ws_worker@staffya.com",
                    "password": "supersecreta123",
                    "full_name": "Worker WS",
                    "role": "worker",
                },
            )
            assert worker_register.status_code == 201
            worker_login = client.post(
                "/api/v1/auth/login",
                json={"email": "ws_worker@staffya.com", "password": "supersecreta123"},
            )
            worker_token = worker_login.json()["access_token"]
            worker_headers = {"Authorization": f"Bearer {worker_token}"}
            worker_profile = client.post(
                "/api/v1/workers/me/profile",
                headers=worker_headers,
                json={"skills": ["mozo"]},
            )
            worker_profile_id = worker_profile.json()["id"]

            created = client.post(
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
            client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
            client.post(
                f"/api/v1/shifts/{shift_id}/assign",
                headers=employer_headers,
                json={"worker_profile_id": worker_profile_id},
            )

            with client.websocket_connect(
                f"/api/v1/chats/{shift_id}/ws?token={worker_token}"
            ) as ws:
                client.post(
                    f"/api/v1/chats/{shift_id}/messages",
                    headers=employer_headers,
                    json={"body": "¡Llegó tu turno!"},
                )
                received = ws.receive_json()
                assert received["body"] == "¡Llegó tu turno!"

            # Sin token, el handshake se rechaza.
            with pytest.raises(WebSocketDisconnect):
                with client.websocket_connect(f"/api/v1/chats/{shift_id}/ws"):
                    pass
    finally:
        app.dependency_overrides.clear()


async def test_no_chat_before_worker_assigned(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "chat_emp5@staffya.com")
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
        f"/api/v1/chats/{shift_id}/messages",
        headers=employer_headers,
        json={"body": "hola?"},
    )
    assert response.status_code == 404
