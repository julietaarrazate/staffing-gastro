"""Quién ve qué en `GET /shifts/{id}`.

Los ids de turno circulan públicamente (links de WhatsApp, `/turno/{id}`).
Antes este endpoint devolvía el turno completo a cualquier sesión, incluida
la posición en vivo del trabajador que iba en camino. Ahora el turno
completo sólo lo ven sus partes; el resto ve turnos abiertos y sin datos del
trabajador."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.test_admin import _make_admin
from tests.test_attendance import (
    _confirmed_shift,
    _employer_with_company,
    _shift_payload,
    _worker_with_profile,
)

pytestmark = pytest.mark.asyncio


async def _en_route_shift(client: AsyncClient, prefix: str):
    near_start = (datetime.now(timezone.utc) + timedelta(minutes=40)).replace(tzinfo=None)
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client,
        f"{prefix}_emp@staffya.com",
        f"{prefix}_w@staffya.com",
        start_at=near_start.isoformat(),
        end_at=(near_start + timedelta(hours=6)).isoformat(),
    )
    reported = await client.post(
        f"/api/v1/shifts/{shift_id}/en-route",
        headers=worker_headers,
        json={"latitude": -34.60, "longitude": -58.40},
    )
    assert reported.status_code == 200
    return shift_id, employer_headers, worker_headers


async def test_other_worker_cannot_read_the_en_route_position(client: AsyncClient):
    shift_id, _employer, _worker = await _en_route_shift(client, "vis1")
    stranger, _ = await _worker_with_profile(client, "vis1_otro@staffya.com")

    response = await client.get(f"/api/v1/shifts/{shift_id}", headers=stranger)

    # El turno ya está confirmado: para quien no es parte, no existe.
    assert response.status_code == 404
    assert "-34.6" not in response.text


async def test_other_employer_cannot_read_a_shift_in_progress(client: AsyncClient):
    shift_id, _employer, _worker = await _en_route_shift(client, "vis2")
    other_employer = await _employer_with_company(client, "vis2_otro@staffya.com")

    response = await client.get(f"/api/v1/shifts/{shift_id}", headers=other_employer)

    assert response.status_code == 404


async def test_parties_still_see_the_full_shift(client: AsyncClient):
    shift_id, employer, worker = await _en_route_shift(client, "vis3")

    for headers in (employer, worker):
        body = (await client.get(f"/api/v1/shifts/{shift_id}", headers=headers)).json()
        assert body["en_route_latitude"] == -34.60
        assert body["worker_profile_id"] is not None


async def test_admin_sees_the_full_shift(client: AsyncClient, session_factory):
    shift_id, _employer, _worker = await _en_route_shift(client, "vis4")
    admin = await _make_admin(client, session_factory, "vis4_admin@staffya.com")

    body = (await client.get(f"/api/v1/shifts/{shift_id}", headers=admin)).json()
    assert body["en_route_latitude"] == -34.60


async def test_open_shift_detail_for_a_worker_has_company_and_no_worker_data(
    client: AsyncClient,
):
    """El caso para el que existe el detalle: un trabajador mira un turno
    abierto antes de postularse. Ve todo lo del turno —incluido el nombre del
    comercio, que antes el detalle no traía— y nada de otra persona."""
    employer = await _employer_with_company(client, "vis5_emp@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(description="Traer delantal negro", meal=True),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, _ = await _worker_with_profile(client, "vis5_w@staffya.com")

    response = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)

    assert response.status_code == 200
    body = response.json()
    assert body["company_name"] == "Bar Palermo"
    assert body["description"] == "Traer delantal negro"
    assert body["meal"] is True
    assert body["worker_profile_id"] is None
    assert body["last_no_show_worker_profile_id"] is None


async def test_reopened_shift_hides_who_did_not_show_up(client: AsyncClient):
    """Un no-show reabre el turno: vuelve a estar abierto, pero la marca de
    quién faltó es de esa persona, no del turno."""
    shift_id, employer, _worker = await _confirmed_shift(
        client, "vis6_emp@staffya.com", "vis6_w@staffya.com"
    )
    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)
    assert marked.status_code == 200
    stranger, _ = await _worker_with_profile(client, "vis6_otro@staffya.com")

    detail = await client.get(f"/api/v1/shifts/{shift_id}", headers=stranger)
    assert detail.status_code == 200
    assert detail.json()["last_no_show_worker_profile_id"] is None

    # El comercio, en cambio, sí sabe quién le faltó.
    own = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert own["last_no_show_worker_profile_id"] is not None
