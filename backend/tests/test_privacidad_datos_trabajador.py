"""Datos de una persona que no deben salir por puertas laterales.

`GET /shifts/{id}` y el mapa del comercio ya cuidaban la posición en vivo de
quien va en camino y el domicilio del trabajador (BUGS.md, TECH_DEBT S4).
La auditoría del 2026-10-10 encontró tres endpoints que devolvían lo mismo
sin recortar: el perfil público, los turnos guardados y "mis postulaciones"."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.test_admin import _make_admin
from tests.test_attendance import (
    _employer_with_company,
    _shift_payload,
    _worker_with_profile,
)

pytestmark = pytest.mark.asyncio

_EN_ROUTE = {"latitude": -34.6037, "longitude": -58.3816}


async def _published_shift_near_start(client: AsyncClient, employer: dict) -> str:
    start = (datetime.now(timezone.utc) + timedelta(minutes=40)).replace(tzinfo=None)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=start.isoformat(), end_at=(start + timedelta(hours=6)).isoformat()
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    return shift_id


async def _assign_and_go_en_route(
    client: AsyncClient, shift_id: str, employer: dict, worker: dict, worker_profile_id: str
) -> None:
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    reported = await client.post(
        f"/api/v1/shifts/{shift_id}/en-route", headers=worker, json=_EN_ROUTE
    )
    assert reported.status_code == 200


# --- Perfil público del trabajador -----------------------------------------


async def _worker_with_home(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers, profile_id = await _worker_with_profile(client, email)
    updated = await client.put(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={
            "skills": ["mozo"],
            "latitude": -34.5875,
            "longitude": -58.4251,
            "birth_date": "1998-03-14",
        },
    )
    assert updated.status_code == 200
    return headers, profile_id


async def test_public_worker_profile_hides_home_and_birth_date(client: AsyncClient):
    _worker, profile_id = await _worker_with_home(client, "priv1_w@staffya.com")
    employer = await _employer_with_company(client, "priv1_emp@staffya.com")
    other_worker, _ = await _worker_with_profile(client, "priv1_otro@staffya.com")

    for headers in (employer, other_worker):
        response = await client.get(f"/api/v1/workers/{profile_id}", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["latitude"] is None
        assert body["longitude"] is None
        assert body["birth_date"] is None
        assert "-34.5875" not in response.text
        # Lo que sí es público sigue estando.
        assert body["age"] is not None
        assert body["skills"] == ["mozo"]


async def test_own_and_admin_view_keep_the_full_profile(
    client: AsyncClient, session_factory
):
    worker, profile_id = await _worker_with_home(client, "priv2_w@staffya.com")
    admin = await _make_admin(client, session_factory, "priv2_admin@staffya.com")

    for headers in (worker, admin):
        body = (await client.get(f"/api/v1/workers/{profile_id}", headers=headers)).json()
        assert body["latitude"] == -34.5875
        assert body["birth_date"] == "1998-03-14"


# --- Turnos guardados -------------------------------------------------------


async def test_saved_shift_hides_the_worker_who_took_it(client: AsyncClient):
    employer = await _employer_with_company(client, "priv3_emp@staffya.com")
    shift_id = await _published_shift_near_start(client, employer)
    saver, _ = await _worker_with_profile(client, "priv3_saver@staffya.com")
    assert (await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=saver)).status_code == 200

    taker, taker_profile_id = await _worker_with_profile(client, "priv3_taker@staffya.com")
    await _assign_and_go_en_route(client, shift_id, employer, taker, taker_profile_id)

    response = await client.get("/api/v1/saved-shifts", headers=saver)
    [saved] = response.json()
    assert saved["id"] == shift_id
    assert saved["worker_profile_id"] is None
    assert saved["en_route_latitude"] is None
    assert str(_EN_ROUTE["latitude"]) not in response.text


async def test_cannot_save_a_shift_that_is_not_open(client: AsyncClient):
    employer = await _employer_with_company(client, "priv4_emp@staffya.com")
    shift_id = await _published_shift_near_start(client, employer)
    taker, taker_profile_id = await _worker_with_profile(client, "priv4_taker@staffya.com")
    await _assign_and_go_en_route(client, shift_id, employer, taker, taker_profile_id)

    stranger, _ = await _worker_with_profile(client, "priv4_otro@staffya.com")
    response = await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=stranger)

    # Ajeno y no abierto = inexistente (no-disclosure).
    assert response.status_code == 404
    assert (await client.get("/api/v1/saved-shifts", headers=stranger)).json() == []


async def test_cannot_save_a_draft(client: AsyncClient):
    employer = await _employer_with_company(client, "priv5_emp@staffya.com")
    draft = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    worker, _ = await _worker_with_profile(client, "priv5_w@staffya.com")

    response = await client.put(f"/api/v1/saved-shifts/{draft.json()['id']}", headers=worker)

    assert response.status_code == 404


async def test_worker_who_took_a_saved_shift_still_sees_it_whole(client: AsyncClient):
    employer = await _employer_with_company(client, "priv6_emp@staffya.com")
    shift_id = await _published_shift_near_start(client, employer)
    taker, taker_profile_id = await _worker_with_profile(client, "priv6_taker@staffya.com")
    await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=taker)
    await _assign_and_go_en_route(client, shift_id, employer, taker, taker_profile_id)

    [saved] = (await client.get("/api/v1/saved-shifts", headers=taker)).json()
    assert saved["worker_profile_id"] == taker_profile_id
    assert saved["en_route_latitude"] == _EN_ROUTE["latitude"]


# --- Mis postulaciones ------------------------------------------------------


async def test_rejected_applicant_does_not_see_who_took_the_shift(client: AsyncClient):
    employer = await _employer_with_company(client, "priv7_emp@staffya.com")
    shift_id = await _published_shift_near_start(client, employer)
    applicant, _ = await _worker_with_profile(client, "priv7_applicant@staffya.com")
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=applicant)
    assert applied.status_code == 201

    taker, taker_profile_id = await _worker_with_profile(client, "priv7_taker@staffya.com")
    await _assign_and_go_en_route(client, shift_id, employer, taker, taker_profile_id)

    response = await client.get("/api/v1/applications/mine", headers=applicant)
    [application] = response.json()
    assert application["shift"]["id"] == shift_id
    assert application["shift"]["worker_profile_id"] is None
    assert application["shift"]["en_route_latitude"] is None
    assert str(_EN_ROUTE["latitude"]) not in response.text


async def test_assigned_applicant_still_sees_their_own_shift_whole(client: AsyncClient):
    employer = await _employer_with_company(client, "priv8_emp@staffya.com")
    shift_id = await _published_shift_near_start(client, employer)
    worker, profile_id = await _worker_with_profile(client, "priv8_w@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    await _assign_and_go_en_route(client, shift_id, employer, worker, profile_id)

    [application] = (await client.get("/api/v1/applications/mine", headers=worker)).json()
    assert application["shift"]["worker_profile_id"] == profile_id
    assert application["shift"]["en_route_latitude"] == _EN_ROUTE["latitude"]
