"""Tests de "Disponible ahora" (ADR-0014): el trabajador prende su posición
real por una ventana corta, para que la distancia que ve el comercio (mapa y
matching) no dependa de dónde vive sino de dónde está buscando en este
momento.

Tres decisiones de Julieta, tomadas antes de escribir código:
1. Ventana de 4 horas (`AVAILABLE_NOW_TTL`) desde que se prende.
2. El pin desplazado (S4, `fuzz_point`) también aplica al admin — mismo
   endpoint que el comercio, sin excepción.
3. Sólo corrige la distancia — nunca sube al trabajador en el ranking del
   matching (`scoring.py` no se toca).

Mismo patrón que test_scheduler.py/test_shift_not_covered.py: manipulación
directa de la fila en la base (vía `session_factory`) para simular el
vencimiento del TTL sin esperar 4 horas reales.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.shift.application import scheduler
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _worker_with_profile(
    client: AsyncClient, email: str, *, latitude: float, longitude: float, **overrides
) -> dict:
    headers = await auth_headers(client, "worker", email)
    payload = {
        "skills": ["mozo"],
        "latitude": latitude,
        "longitude": longitude,
        "is_available": True,
    }
    payload.update(overrides)
    await client.post("/api/v1/workers/me/profile", headers=headers, json=payload)
    return headers


async def _expire_available_now(
    session_factory: async_sessionmaker[AsyncSession], email: str
) -> None:
    """Empuja `available_now_until` al pasado, directo en la base — mismo
    truco que usan los tests del scheduler para simular que ya venció un
    período de gracia, sin esperarlo de verdad."""
    async with session_factory() as session:
        users = SqlAlchemyUserRepository(session)
        user = await users.get_by_email(email)
        stmt = select(WorkerProfileModel).where(WorkerProfileModel.user_id == user.id)
        model = (await session.execute(stmt)).scalar_one()
        model.available_now_until = datetime.now(timezone.utc) - timedelta(minutes=1)
        await session.commit()


async def test_available_now_starts_off(client: AsyncClient):
    headers = await _worker_with_profile(
        client, "disp1@staffya.com", latitude=-34.58, longitude=-58.43
    )
    response = await client.get("/api/v1/workers/me/available-now", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"active": False, "until": None}


async def test_worker_can_turn_available_now_on_and_off(client: AsyncClient):
    headers = await _worker_with_profile(
        client, "disp2@staffya.com", latitude=-34.58, longitude=-58.43
    )
    on = await client.post(
        "/api/v1/workers/me/available-now",
        headers=headers,
        json={"latitude": -34.6, "longitude": -58.45},
    )
    assert on.status_code == 200
    body = on.json()
    assert body["active"] is True
    assert body["until"] is not None

    off = await client.delete("/api/v1/workers/me/available-now", headers=headers)
    assert off.status_code == 204

    status_after = await client.get("/api/v1/workers/me/available-now", headers=headers)
    assert status_after.json() == {"active": False, "until": None}


async def test_available_now_requires_a_worker_profile(client: AsyncClient):
    headers = await auth_headers(client, "worker", "disp_sin_perfil@staffya.com")
    response = await client.post(
        "/api/v1/workers/me/available-now",
        headers=headers,
        json={"latitude": -34.6, "longitude": -58.45},
    )
    assert response.status_code == 404


async def test_search_map_uses_the_live_position_while_it_is_active(
    client: AsyncClient,
):
    """El caso central del ADR: un trabajador que vive lejos pero está
    buscando cerca AHORA tiene que aparecer cerca, no en su domicilio."""
    employer_headers = await auth_headers(client, "employer", "emp_disp1@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer_headers,
        json={"name": "Bar Test", "city": "Palermo", "latitude": -34.6, "longitude": -58.45},
    )
    worker_headers = await _worker_with_profile(
        client, "disp3@staffya.com", latitude=-31.4, longitude=-64.2  # Córdoba: lejos.
    )
    await client.post(
        "/api/v1/workers/me/available-now",
        headers=worker_headers,
        json={"latitude": -34.6, "longitude": -58.45},  # Ahora en Palermo.
    )

    response = await client.get(
        "/api/v1/matching/search",
        headers=employer_headers,
        params={"latitude": -34.6, "longitude": -58.45},
    )
    assert response.status_code == 200
    worker = response.json()[0]
    assert worker["is_live"] is True
    assert worker["position_updated_at"] is not None
    # Cerca de Palermo, no de Córdoba (~650 km) — el pin sigue desplazado
    # (S4) pero la distancia real tiene que reflejar la posición vigente.
    assert worker["distance_km"] < 5


async def test_search_map_falls_back_to_profile_position_once_available_now_expires(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    employer_headers = await auth_headers(client, "employer", "emp_disp2@staffya.com")
    worker_headers = await _worker_with_profile(
        client, "disp4@staffya.com", latitude=-31.4, longitude=-64.2
    )
    await client.post(
        "/api/v1/workers/me/available-now",
        headers=worker_headers,
        json={"latitude": -34.6, "longitude": -58.45},
    )
    await _expire_available_now(session_factory, "disp4@staffya.com")

    response = await client.get(
        "/api/v1/matching/search",
        headers=employer_headers,
        params={"latitude": -34.6, "longitude": -58.45},
    )
    worker = response.json()[0]
    assert worker["is_live"] is False
    assert worker["position_updated_at"] is None
    # Vuelve a la zona del perfil (Córdoba): lejos de Palermo otra vez.
    assert worker["distance_km"] > 500


async def test_top_candidates_use_the_live_position_too(client: AsyncClient):
    """ADR-0014 punto 1: "el matching Y la búsqueda" miden desde la posición
    vigente — no sólo el mapa. Sin esto, un trabajador que se movió sigue
    perdiendo turnos cercanos que podría cubrir."""
    employer_headers = await auth_headers(client, "employer", "emp_disp3@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=employer_headers,
        json={"name": "Bar Test", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
    )
    worker_headers = await _worker_with_profile(
        client, "disp5@staffya.com", latitude=-31.4, longitude=-64.2
    )
    await client.post(
        "/api/v1/workers/me/available-now",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    shift = await employer_headers_publish_shift(client, employer_headers)

    response = await client.get(
        f"/api/v1/shifts/{shift}/candidates", headers=employer_headers
    )
    assert response.status_code == 200
    candidate = response.json()[0]
    assert candidate["distance_km"] < 5


async def employer_headers_publish_shift(client: AsyncClient, headers: dict) -> str:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "latitude": -34.58,
        "longitude": -58.43,
    }
    created = await client.post("/api/v1/shifts", headers=headers, json=payload)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    return shift_id


async def test_available_now_cleanup_expires_it_and_reports_next_deadline(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession], monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)

    expired_headers = await _worker_with_profile(
        client, "disp6@staffya.com", latitude=-34.58, longitude=-58.43
    )
    await client.post(
        "/api/v1/workers/me/available-now",
        headers=expired_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    await _expire_available_now(session_factory, "disp6@staffya.com")

    still_active_headers = await _worker_with_profile(
        client, "disp7@staffya.com", latitude=-34.58, longitude=-58.43
    )
    await client.post(
        "/api/v1/workers/me/available-now",
        headers=still_active_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )

    next_deadline = await scheduler.run_available_now_cleanup()

    # El vencido se apagó solo.
    expired_status = await client.get(
        "/api/v1/workers/me/available-now", headers=expired_headers
    )
    assert expired_status.json() == {"active": False, "until": None}

    # El vigente no se tocó, y su vencimiento es la próxima deadline.
    still_active_status = await client.get(
        "/api/v1/workers/me/available-now", headers=still_active_headers
    )
    assert still_active_status.json()["active"] is True
    assert next_deadline is not None
