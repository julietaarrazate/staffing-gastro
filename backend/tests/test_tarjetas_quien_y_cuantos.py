"""G19: las tarjetas dicen quién y cuántos.

- `GET /applications/mine` trae el nombre del comercio de cada turno.
- `GET /shifts/me` suma `pending_applicants_count` (sólo postulaciones
  PENDIENTES, una consulta agrupada) y esa cifra es del comercio dueño: no
  viaja por el feed, el turno público ni las rutas del trabajador."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.test_application import (
    _employer_with_company,
    _published_shift,
    _worker_with_profile,
)
from tests.test_shift import _count_queries

pytestmark = pytest.mark.asyncio

API = "/api/v1"


async def _future_shift(client: AsyncClient, employer: dict) -> str:
    """Un turno publicado que sigue vigente (el feed y la página pública no
    muestran turnos ya empezados)."""
    start = (datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None)
    created = await client.post(
        f"{API}/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=6)).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    shift_id = created.json()["id"]
    await client.post(f"{API}/shifts/{shift_id}/publish", headers=employer)
    return shift_id


async def _apply(client: AsyncClient, shift_id: str, headers: dict) -> str:
    response = await client.post(f"{API}/applications/shifts/{shift_id}", headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


async def _count_of(client: AsyncClient, employer: dict, shift_id: str) -> int | None:
    mine = await client.get(f"{API}/shifts/me", headers=employer)
    assert mine.status_code == 200
    [shift] = [s for s in mine.json() if s["id"] == shift_id]
    return shift["pending_applicants_count"]


async def test_applications_mine_carries_the_company_name(client: AsyncClient):
    employer = await _employer_with_company(client, "g19_emp1@staffya.com")
    shift_id = await _future_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "g19_w1@staffya.com")
    await _apply(client, shift_id, worker)

    response = await client.get(f"{API}/applications/mine", headers=worker)

    assert response.status_code == 200
    [item] = response.json()
    assert item["shift"]["company_name"] == "Bar Palermo"
    # Es el mismo nombre que el trabajador ya ve en el turno.
    in_feed = await client.get(f"{API}/shifts/feed", headers=worker)
    assert {s["company_name"] for s in in_feed.json() if s["id"] == shift_id} == {"Bar Palermo"}


async def test_applications_mine_still_hides_the_worker_when_someone_else_got_it(
    client: AsyncClient,
):
    employer = await _employer_with_company(client, "g19_emp2@staffya.com")
    shift_id = await _published_shift(client, employer)
    loser, _ = await _worker_with_profile(client, "g19_w2a@staffya.com")
    winner, winner_id = await _worker_with_profile(client, "g19_w2b@staffya.com")
    await _apply(client, shift_id, loser)
    await _apply(client, shift_id, winner)
    await client.post(
        f"{API}/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": winner_id},
    )

    response = await client.get(f"{API}/applications/mine", headers=loser)

    [item] = response.json()
    assert item["shift"]["company_name"] == "Bar Palermo"
    assert item["shift"]["worker_profile_id"] is None
    assert item["shift"]["pending_applicants_count"] is None


async def test_pending_count_is_zero_one_and_many(client: AsyncClient):
    employer = await _employer_with_company(client, "g19_emp3@staffya.com")
    shift_id = await _published_shift(client, employer)
    assert await _count_of(client, employer, shift_id) == 0

    first, _ = await _worker_with_profile(client, "g19_w3a@staffya.com")
    await _apply(client, shift_id, first)
    assert await _count_of(client, employer, shift_id) == 1

    second, _ = await _worker_with_profile(client, "g19_w3b@staffya.com")
    third, _ = await _worker_with_profile(client, "g19_w3c@staffya.com")
    await _apply(client, shift_id, second)
    await _apply(client, shift_id, third)
    assert await _count_of(client, employer, shift_id) == 3


async def test_pending_count_ignores_withdrawn_rejected_and_accepted(client: AsyncClient):
    employer = await _employer_with_company(client, "g19_emp4@staffya.com")
    shift_id = await _published_shift(client, employer)
    leaves, _ = await _worker_with_profile(client, "g19_w4a@staffya.com")
    chosen, chosen_id = await _worker_with_profile(client, "g19_w4b@staffya.com")
    passed_over, _ = await _worker_with_profile(client, "g19_w4c@staffya.com")
    waiting, _ = await _worker_with_profile(client, "g19_w4d@staffya.com")

    withdrawn_id = await _apply(client, shift_id, leaves)
    await client.post(f"{API}/applications/{withdrawn_id}/withdraw", headers=leaves)
    await _apply(client, shift_id, chosen)
    await _apply(client, shift_id, passed_over)
    assert await _count_of(client, employer, shift_id) == 2

    await client.post(
        f"{API}/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": chosen_id},
    )
    # Al asignar, la elegida queda ACEPTADA y las demás dejan de estar en la
    # cola: no hay nada pendiente que decidir.
    applicants = await client.get(f"{API}/applications/shifts/{shift_id}", headers=employer)
    statuses = sorted(a["status"] for a in applicants.json())
    assert "aceptada" in statuses and "pendiente" not in statuses
    assert await _count_of(client, employer, shift_id) == 0
    del waiting


async def test_pending_count_is_per_shift(client: AsyncClient):
    employer = await _employer_with_company(client, "g19_emp5@staffya.com")
    busy = await _published_shift(client, employer)
    quiet = await _published_shift(client, employer)
    a, _ = await _worker_with_profile(client, "g19_w5a@staffya.com")
    b, _ = await _worker_with_profile(client, "g19_w5b@staffya.com")
    await _apply(client, busy, a)
    await _apply(client, busy, b)

    assert await _count_of(client, employer, busy) == 2
    assert await _count_of(client, employer, quiet) == 0


async def test_pending_count_is_one_grouped_query(client: AsyncClient, session_factory):
    employer = await _employer_with_company(client, "g19_emp6@staffya.com")
    shifts = [await _published_shift(client, employer) for _ in range(4)]
    worker, _ = await _worker_with_profile(client, "g19_w6@staffya.com")
    for shift_id in shifts:
        await _apply(client, shift_id, worker)

    with _count_queries(session_factory) as small:
        await client.get(f"{API}/shifts/me?limit=1", headers=employer)
    with _count_queries(session_factory) as big:
        await client.get(f"{API}/shifts/me", headers=employer)

    # Con 4 turnos no se hacen más consultas que con 1: el conteo no es por turno.
    assert big["n"] == small["n"]


async def test_pending_count_does_not_travel_outside_the_owner_company(
    client: AsyncClient,
):
    employer = await _employer_with_company(client, "g19_emp7@staffya.com")
    shift_id = await _future_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "g19_w7@staffya.com")
    other, _ = await _worker_with_profile(client, "g19_w7b@staffya.com")
    await _apply(client, shift_id, worker)

    feed = await client.get(f"{API}/shifts/feed", headers=other)
    public = await client.get(f"{API}/shifts/{shift_id}/public")
    detail = await client.get(f"{API}/shifts/{shift_id}", headers=other)
    for response in (feed, public, detail):
        assert response.status_code == 200
        assert "pending_applicants_count" not in _strip_nulls(response.json())
    assert any(s["id"] == shift_id for s in feed.json())

    mine_applications = await client.get(f"{API}/applications/mine", headers=worker)
    assert mine_applications.json()[0]["shift"]["pending_applicants_count"] is None


async def test_assigned_worker_does_not_see_the_count_in_shifts_mine(client: AsyncClient):
    employer = await _employer_with_company(client, "g19_emp8@staffya.com")
    shift_id = await _published_shift(client, employer)
    chosen, chosen_id = await _worker_with_profile(client, "g19_w8a@staffya.com")
    await _apply(client, shift_id, chosen)
    await client.post(
        f"{API}/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": chosen_id},
    )

    response = await client.get(f"{API}/shifts/mine", headers=chosen)

    [shift] = response.json()
    assert shift["pending_applicants_count"] is None


def _strip_nulls(payload):
    """El contrato permite la clave con `null`; lo que no puede haber es un
    número. Se descartan los `None` para afirmar 'no hay cifra'."""
    items = payload if isinstance(payload, list) else [payload]
    return {
        key
        for item in items
        for key, value in item.items()
        if value is not None and key == "pending_applicants_count"
    }
