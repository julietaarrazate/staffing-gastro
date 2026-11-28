"""Quién ve qué en `GET /shifts/{id}`.

Los ids de turno circulan públicamente (links de WhatsApp, `/turno/{id}`).
Antes este endpoint devolvía el turno completo a cualquier sesión, incluida
la posición en vivo del trabajador que iba en camino. Ahora el turno
completo sólo lo ven sus partes; el resto ve turnos abiertos y sin datos del
trabajador."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import TEST_GUEST_PIN
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
    # Empezó hace 20 minutos y le quedan horas: tras la ausencia se reofrece
    # (U080) y vuelve a estar abierto. Con el horario ya terminado pasaría a
    # «no cubierto» y para quien no es parte dejaría de existir.
    started = (datetime.now(timezone.utc) - timedelta(minutes=20)).replace(tzinfo=None)
    shift_id, employer, _worker = await _confirmed_shift(
        client,
        "vis6_emp@staffya.com",
        "vis6_w@staffya.com",
        start_at=started.isoformat(),
        end_at=(started + timedelta(hours=6)).isoformat(),
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


async def test_worker_with_session_sees_the_exact_address_but_the_public_page_does_not(
    client: AsyncClient,
):
    """Decisión de Julieta (2026-11-27): quien tiene sesión de trabajador ve la
    dirección exacta del local en el detalle (antes y después de postularse) y en
    «Mis turnos». La página pública (sin sesión) sigue sin ella."""
    employer = await _employer_with_company(client, "dir_emp@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            address="Gorriti 5000",
            city="Palermo",
            latitude=-34.58,
            longitude=-58.43,
            start_at=(datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None).isoformat(),
            end_at=(datetime.now(timezone.utc) + timedelta(days=3, hours=6)).replace(tzinfo=None).isoformat(),
        ),
    )
    assert created.status_code == 201
    shift_id = created.json()["id"]
    assert created.json()["address"] == "Gorriti 5000"
    published = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    assert published.status_code == 200
    worker, _ = await _worker_with_profile(client, "dir_w@staffya.com")

    detail = await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)
    assert detail.status_code == 200
    assert detail.json()["address"] == "Gorriti 5000"

    public = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert public.status_code == 200
    assert "Gorriti" not in public.text
    assert "address" not in public.json()
    assert "latitude" not in public.json()


async def test_assigned_worker_sees_the_address_in_my_shifts(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client, "dir2_emp@staffya.com", "dir2_w@staffya.com", address="Gorriti 5000"
    )
    mine = await client.get("/api/v1/shifts/mine", headers=worker_headers)
    assert mine.status_code == 200
    assert {s["address"] for s in mine.json() if s["id"] == shift_id} == {"Gorriti 5000"}


async def test_exact_address_only_for_owner_admin_and_workers_with_their_own_account(
    client: AsyncClient, session_factory
):
    """La dirección exacta (`address`) la ven el comercio dueño, la admin y los
    trabajadores con cuenta propia, en el detalle y en el feed. Otro comercio y
    la cuenta invitada reciben `address: null` (la zona sigue)."""
    ini = (datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None)
    owner = await _employer_with_company(client, "dir3_emp@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=owner,
        json=_shift_payload(
            address="Gorriti 5000",
            city="Palermo",
            start_at=ini.isoformat(),
            end_at=(ini + timedelta(hours=6)).isoformat(),
        ),
    )
    shift_id = created.json()["id"]
    assert (await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=owner)).status_code == 200

    other_employer = await _employer_with_company(client, "dir3_otro@staffya.com")
    worker, _ = await _worker_with_profile(client, "dir3_w@staffya.com")
    admin = await _make_admin(client, session_factory, "dir3_admin@staffya.com")
    guest_resp = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "worker"}
    )
    assert guest_resp.status_code == 200
    guest = {"Authorization": f"Bearer {guest_resp.json()['access_token']}"}
    guest_emp_resp = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "employer"}
    )
    guest_emp = {"Authorization": f"Bearer {guest_emp_resp.json()['access_token']}"}

    async def detalle(headers):
        r = await client.get(f"/api/v1/shifts/{shift_id}", headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    async def en_feed(headers):
        r = await client.get("/api/v1/shifts/feed", params={"scope": "all"}, headers=headers)
        assert r.status_code == 200, r.text
        return [x for x in r.json() if x["id"] == shift_id]

    for quien in (owner, admin, worker):
        assert (await detalle(quien))["address"] == "Gorriti 5000"
    for quien in (other_employer, guest, guest_emp):
        d = await detalle(quien)
        assert d["address"] is None
        assert d["city"] == "Palermo"
        assert "Gorriti" not in str(d)

    feed_worker = await en_feed(worker)
    assert [x["address"] for x in feed_worker] == ["Gorriti 5000"]
    for quien in (other_employer, guest, guest_emp):
        feed = await en_feed(quien)
        assert feed, "el turno abierto sigue apareciendo en el feed"
        assert all(x["address"] is None and x["city"] == "Palermo" for x in feed)
        assert "Gorriti" not in str(feed)
