"""Tests de integración del módulo support (tickets de soporte usuario ↔ Oído)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from tests.conftest import auth_headers, login

pytestmark = pytest.mark.asyncio


async def _make_admin(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession], email: str
) -> dict:
    await auth_headers(client, "employer", email)
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_worker_opens_ticket_and_sees_it_in_mine(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w_sup1@staffya.com")
    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "cv_documentos", "subject": "No puedo subir mi CV", "body": "Me da error al elegir el archivo."},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["category"] == "cv_documentos"
    assert body["subject"] == "No puedo subir mi CV"
    assert body["status"] == "abierto"
    ticket_id = body["id"]

    mine = await client.get("/api/v1/support/tickets/mine", headers=worker)
    assert mine.status_code == 200
    assert any(t["id"] == ticket_id for t in mine.json())


async def test_ticket_detail_includes_first_message(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w_sup2@staffya.com")
    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "general", "subject": "Consulta", "body": "¿Cómo cambio mi zona?"},
    )
    ticket_id = created.json()["id"]

    detail = await client.get(f"/api/v1/support/tickets/{ticket_id}", headers=worker)
    assert detail.status_code == 200
    body = detail.json()
    assert len(body["messages"]) == 1
    assert body["messages"][0]["body"] == "¿Cómo cambio mi zona?"


async def test_other_user_cannot_see_someone_elses_ticket(client: AsyncClient):
    worker_a = await auth_headers(client, "worker", "w_sup3a@staffya.com")
    worker_b = await auth_headers(client, "worker", "w_sup3b@staffya.com")
    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker_a,
        json={"category": "general", "subject": "Privado", "body": "No debería verse."},
    )
    ticket_id = created.json()["id"]

    response = await client.get(f"/api/v1/support/tickets/{ticket_id}", headers=worker_b)
    assert response.status_code == 404


async def test_admin_replies_and_user_gets_notified(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    worker = await auth_headers(client, "worker", "w_sup4@staffya.com")
    admin = await _make_admin(client, session_factory, "admin_sup4@staffya.com")

    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "pagos", "subject": "Duda de pago", "body": "¿Cuándo cobro?"},
    )
    ticket_id = created.json()["id"]

    reply = await client.post(
        f"/api/v1/support/tickets/{ticket_id}/messages",
        headers=admin,
        json={"body": "Se acredita a las 48hs de finalizado el turno."},
    )
    assert reply.status_code == 201
    assert reply.json()["body"] == "Se acredita a las 48hs de finalizado el turno."

    detail = await client.get(f"/api/v1/support/tickets/{ticket_id}", headers=worker)
    assert len(detail.json()["messages"]) == 2

    notifications = await client.get("/api/v1/notifications", headers=worker)
    assert notifications.status_code == 200
    notif = next(n for n in notifications.json() if n["type"] == "support_reply")
    assert "Duda de pago" in notif["message"]


async def test_worker_cannot_reply_to_closed_ticket(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w_sup5@staffya.com")
    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "otro", "subject": "Ya se resolvió", "body": "Mensaje inicial."},
    )
    ticket_id = created.json()["id"]

    closed = await client.post(f"/api/v1/support/tickets/{ticket_id}/close", headers=worker)
    assert closed.status_code == 200
    assert closed.json()["status"] == "cerrado"

    response = await client.post(
        f"/api/v1/support/tickets/{ticket_id}/messages",
        headers=worker,
        json={"body": "Otro mensaje"},
    )
    assert response.status_code == 400


async def test_admin_can_still_reply_to_closed_ticket(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Cerrar es una acción del usuario/admin, no bloquea al admin si necesita
    aclarar algo después — sólo el usuario no puede reabrir mandando mensajes."""
    worker = await auth_headers(client, "worker", "w_sup6@staffya.com")
    admin = await _make_admin(client, session_factory, "admin_sup6@staffya.com")

    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "otro", "subject": "Test", "body": "Mensaje inicial."},
    )
    ticket_id = created.json()["id"]
    await client.post(f"/api/v1/support/tickets/{ticket_id}/close", headers=worker)

    reply = await client.post(
        f"/api/v1/support/tickets/{ticket_id}/messages",
        headers=admin,
        json={"body": "Una aclaración final."},
    )
    assert reply.status_code == 201


async def test_worker_cannot_list_all_tickets(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w_sup7@staffya.com")
    response = await client.get("/api/v1/support/tickets", headers=worker)
    assert response.status_code == 403


async def test_admin_lists_all_tickets_enriched(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    worker = await auth_headers(client, "worker", "w_sup8@staffya.com")
    admin = await _make_admin(client, session_factory, "admin_sup8@staffya.com")

    await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "cuenta", "subject": "No puedo entrar", "body": "Olvidé mi contraseña."},
    )

    listed = await client.get("/api/v1/support/tickets", headers=admin)
    assert listed.status_code == 200
    tickets = listed.json()
    assert len(tickets) >= 1
    ticket = next(t for t in tickets if t["subject"] == "No puedo entrar")
    assert ticket["user_full_name"] == "Test User"
    assert ticket["message_count"] == 1
    assert ticket["last_message_at"] is not None


async def test_admin_can_filter_tickets_by_status(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    worker = await auth_headers(client, "worker", "w_sup9@staffya.com")
    admin = await _make_admin(client, session_factory, "admin_sup9@staffya.com")

    created = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "otro", "subject": "Para cerrar", "body": "Mensaje."},
    )
    ticket_id = created.json()["id"]
    await client.post(f"/api/v1/support/tickets/{ticket_id}/close", headers=worker)

    open_tickets = await client.get(
        "/api/v1/support/tickets", headers=admin, params={"status": "abierto"}
    )
    assert all(t["id"] != ticket_id for t in open_tickets.json())

    closed_tickets = await client.get(
        "/api/v1/support/tickets", headers=admin, params={"status": "cerrado"}
    )
    assert any(t["id"] == ticket_id for t in closed_tickets.json())


async def test_empty_ticket_body_is_rejected(client: AsyncClient):
    worker = await auth_headers(client, "worker", "w_sup10@staffya.com")
    response = await client.post(
        "/api/v1/support/tickets",
        headers=worker,
        json={"category": "general", "subject": "  ", "body": "algo"},
    )
    assert response.status_code == 422
