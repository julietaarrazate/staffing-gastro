"""Tests del ping en tiempo real de turnos urgentes (ADR-0005).

Al publicar un turno con `urgent=True` y coordenadas, el turno "sale a
buscar" trabajadores: se notifica de inmediato a los `URGENT_PING_LIMIT`
candidatos disponibles con la skill pedida más cercanos
(`NotificationType.NEARBY_URGENT_SHIFT`).
"""

from typing import Annotated

import pytest
from fastapi import Depends
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.main import app
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.api.dependencies import get_shift_service
from app.modules.shift.application.services import URGENT_PING_LIMIT, ShiftService
from app.modules.shift.domain.repositories import NearbyCandidate, NearbyCandidatesPort
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

PALERMO = {"latitude": -34.58, "longitude": -58.43}


async def _employer_with_company(client: AsyncClient, email: str, **overrides) -> dict:
    headers = await auth_headers(client, "employer", email)
    payload = {"name": "Bar Palermo", "city": "Palermo", **PALERMO}
    payload.update(overrides)
    await client.post("/api/v1/companies/me/profile", headers=headers, json=payload)
    return headers


async def _worker_profile(client: AsyncClient, email: str, **overrides) -> dict:
    headers = await auth_headers(client, "worker", email)
    payload = {"skills": ["mozo"], "is_available": True, **PALERMO}
    payload.update(overrides)
    await client.post("/api/v1/workers/me/profile", headers=headers, json=payload)
    return headers


async def _publish_shift(client: AsyncClient, headers: dict, **overrides) -> str:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "urgent": True,
        **PALERMO,
    }
    payload.update(overrides)
    created = await client.post("/api/v1/shifts", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    published = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    assert published.status_code == 200, published.text
    return shift_id


async def _urgent_pings(client: AsyncClient, headers: dict) -> list[dict]:
    response = await client.get("/api/v1/notifications", headers=headers)
    assert response.status_code == 200
    return [n for n in response.json() if n["type"] == "nearby_urgent_shift"]


async def test_urgent_publish_pings_nearby_matching_available_worker(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "urg_emp1@staffya.com")
    worker_headers = await _worker_profile(client, "urg_w1@staffya.com")

    await _publish_shift(client, employer_headers)

    pings = await _urgent_pings(client, worker_headers)
    assert len(pings) == 1
    ping = pings[0]
    assert ping["title"] == "⚡ Turno urgente cerca tuyo"
    assert ping["read"] is False
    # Español, con el rol y el nombre del comercio (ya visible en el feed) y
    # una distancia aproximada.
    assert "mozo" in ping["message"]
    assert "Bar Palermo" in ping["message"]
    assert "km" in ping["message"]


async def test_non_urgent_publish_sends_zero_pings(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "urg_emp2@staffya.com")
    worker_headers = await _worker_profile(client, "urg_w2@staffya.com")

    await _publish_shift(client, employer_headers, urgent=False)

    assert await _urgent_pings(client, worker_headers) == []


async def test_shift_without_coordinates_sends_zero_pings(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "urg_emp2b@staffya.com")
    worker_headers = await _worker_profile(client, "urg_w2b@staffya.com")

    await _publish_shift(client, employer_headers, latitude=None, longitude=None)

    assert await _urgent_pings(client, worker_headers) == []


async def test_excludes_wrong_skill_unavailable_and_without_coordinates(
    client: AsyncClient,
):
    employer_headers = await _employer_with_company(client, "urg_emp3@staffya.com")
    match_headers = await _worker_profile(client, "urg_w3_match@staffya.com")
    wrong_skill_headers = await _worker_profile(
        client, "urg_w3_skill@staffya.com", skills=["bartender"]
    )
    unavailable_headers = await _worker_profile(
        client, "urg_w3_unavail@staffya.com", is_available=False
    )
    no_coords_headers = await _worker_profile(
        client, "urg_w3_nocoords@staffya.com", latitude=None, longitude=None
    )

    await _publish_shift(client, employer_headers)

    assert len(await _urgent_pings(client, match_headers)) == 1
    assert await _urgent_pings(client, wrong_skill_headers) == []
    assert await _urgent_pings(client, unavailable_headers) == []
    assert await _urgent_pings(client, no_coords_headers) == []


async def test_more_than_limit_candidates_only_pings_top_n(client: AsyncClient):
    employer_headers = await _employer_with_company(client, "urg_emp4@staffya.com")
    worker_headers_list = [
        await _worker_profile(client, f"urg_w4_{i}@staffya.com")
        for i in range(URGENT_PING_LIMIT + 2)
    ]

    await _publish_shift(client, employer_headers)

    total_pinged = 0
    for headers in worker_headers_list:
        total_pinged += len(await _urgent_pings(client, headers))
    assert total_pinged == URGENT_PING_LIMIT


async def test_fan_out_failure_does_not_break_publish(client: AsyncClient):
    """Si el puerto de candidatos cercanos falla, la publicación del turno
    igual se completa (el fan-out es secundario, ver ADR-0005)."""

    class _BrokenNearbyCandidatesPort(NearbyCandidatesPort):
        async def list_nearby(
            self, skill, latitude, longitude, limit: int = 10
        ) -> list[NearbyCandidate]:
            raise RuntimeError("matching no disponible")

    async def _broken_shift_service(
        session: Annotated[AsyncSession, Depends(get_session)],
    ) -> ShiftService:
        return ShiftService(
            shifts=SqlAlchemyShiftRepository(session),
            workers=SqlAlchemyWorkerProfileRepository(session),
            companies=SqlAlchemyCompanyProfileRepository(session),
            notifications=SqlAlchemyNotificationRepository(session),
            nearby_candidates=_BrokenNearbyCandidatesPort(),
        )

    app.dependency_overrides[get_shift_service] = _broken_shift_service
    try:
        employer_headers = await _employer_with_company(client, "urg_emp5@staffya.com")
        worker_headers = await _worker_profile(client, "urg_w5@staffya.com")

        shift_id = await _publish_shift(client, employer_headers)

        shift = await client.get(f"/api/v1/shifts/{shift_id}", headers=employer_headers)
        assert shift.status_code == 200
        assert shift.json()["status"] == "publicado"

        assert await _urgent_pings(client, worker_headers) == []
    finally:
        del app.dependency_overrides[get_shift_service]
