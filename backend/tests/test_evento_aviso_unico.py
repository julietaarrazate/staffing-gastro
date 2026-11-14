"""Avisos al publicar un evento (U086): uno solo por evento y por persona, y
sin avisar de un puesto que se pisa con otro del mismo evento donde la persona
ya está confirmada."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.shift.application import scheduler
from app.modules.shift.application.services import ESCALATION_DELAY
from app.modules.shift.infrastructure.models import ShiftModel
from tests.conftest import auth_headers

PALERMO = (-34.5875, -58.4300)


async def _worker(client: AsyncClient, email: str, skills: list[str]) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={
            "city": "Palermo",
            "latitude": PALERMO[0] - 0.001,
            "longitude": PALERMO[1] - 0.001,
            "skills": skills,
            "is_available": True,
        },
    )
    return headers, profile.json()["id"]


async def _employer(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Salón Palermo", "city": "Palermo"},
    )
    return headers


async def _publish_event(client: AsyncClient, employer: dict, roles: list[dict]) -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=2)
    response = await client.post(
        "/api/v1/shifts/events",
        headers=employer,
        json={
            "name": "Boda Martínez",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=6)).isoformat(),
            "city": "Palermo",
            "latitude": PALERMO[0],
            "longitude": PALERMO[1],
            "roles": roles,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _avisos(client: AsyncClient, headers: dict, tipo: str) -> list[dict]:
    recibidas = await client.get("/api/v1/notifications", headers=headers)
    return [n for n in recibidas.json() if n["type"] == tipo]


async def test_un_solo_aviso_por_evento_y_por_persona(client: AsyncClient):
    mozo, _ = await _worker(client, "evt_mozo@staffya.com", ["mozo"])
    ambos, _ = await _worker(client, "evt_ambos@staffya.com", ["mozo", "bartender"])
    cocinero, _ = await _worker(client, "evt_cocinero@staffya.com", ["cocinero"])
    employer = await _employer(client, "evt_bar@staffya.com")

    evento = await _publish_event(
        client,
        employer,
        [
            {"position": "mozo", "count": 3, "pay_amount": "50000.00"},
            {"position": "bartender", "count": 2, "pay_amount": "60000.00"},
        ],
    )

    del_mozo = await _avisos(client, mozo, "new_shift_nearby")
    assert len(del_mozo) == 1
    assert del_mozo[0]["title"] == "Evento Boda Martínez: 3 puestos cerca tuyo"
    assert del_mozo[0]["link"].startswith("/turno/")

    de_ambos = await _avisos(client, ambos, "new_shift_nearby")
    assert len(de_ambos) == 1
    assert de_ambos[0]["title"] == "Evento Boda Martínez: 5 puestos cerca tuyo"
    assert de_ambos[0]["link"].removeprefix("/turno/") in {s["id"] for s in evento["shifts"]}

    assert await _avisos(client, cocinero, "new_shift_nearby") == []


async def test_evento_de_un_puesto_avisa_como_turno_suelto(client: AsyncClient):
    mozo, _ = await _worker(client, "evt1_mozo@staffya.com", ["mozo"])
    employer = await _employer(client, "evt1_bar@staffya.com")

    await _publish_event(
        client, employer, [{"position": "mozo", "count": 1, "pay_amount": "50000.00"}]
    )

    avisos = await _avisos(client, mozo, "new_shift_nearby")
    assert len(avisos) == 1
    assert avisos[0]["link"].startswith("/turno/")


async def test_no_se_avisa_del_puesto_que_se_pisa_con_el_que_ya_confirmo(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch,
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    confirmada, confirmada_profile = await _worker(client, "evt_conf@staffya.com", ["mozo"])
    libre, _ = await _worker(client, "evt_libre@staffya.com", ["mozo"])
    employer = await _employer(client, "evt_esc_bar@staffya.com")

    evento = await _publish_event(
        client, employer, [{"position": "mozo", "count": 2, "pay_amount": "50000.00"}]
    )
    primero, segundo = (s["id"] for s in evento["shifts"])
    assigned = await client.post(
        f"/api/v1/shifts/{primero}/assign",
        headers=employer,
        json={"worker_profile_id": confirmada_profile},
    )
    assert assigned.status_code == 200
    confirmed = await client.post(f"/api/v1/shifts/{primero}/confirm", headers=confirmada)
    assert confirmed.status_code == 200

    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(segundo))
        model.published_at = datetime.now(timezone.utc) - ESCALATION_DELAY - timedelta(minutes=1)
        await session.commit()
    await scheduler.run_escalation_check()

    assert len(await _avisos(client, libre, "urgent_shift_nearby")) == 1
    assert await _avisos(client, confirmada, "urgent_shift_nearby") == []
