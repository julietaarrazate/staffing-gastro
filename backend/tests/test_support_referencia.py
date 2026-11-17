"""U110: un ticket de soporte puede atarse a un turno o a un comercio.

Las reglas de quién puede atar qué viven en `SupportService`; acá se prueban
de punta a punta. Lo ajeno y lo inexistente dan el mismo 404 (no-disclosure)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.test_admin import _make_admin
from tests.test_attendance import _employer_with_company, _worker_with_profile

pytestmark = pytest.mark.asyncio


def _future_payload(**overrides) -> dict:
    start = (datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None, microsecond=0)
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=6)).isoformat(),
        "pay_amount": "70000.00",
        "city": "Palermo",
        "title": "Mozo para el sábado",
    }
    payload.update(overrides)
    return payload


async def _published_shift(client: AsyncClient, employer: dict, **overrides) -> str:
    created = await client.post(
        "/api/v1/shifts", headers=employer, json=_future_payload(**overrides)
    )
    shift_id = created.json()["id"]
    published = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    assert published.status_code == 200
    return shift_id


async def _company_id(client: AsyncClient, employer: dict) -> str:
    return (await client.get("/api/v1/companies/me/profile", headers=employer)).json()["id"]


async def _ticket(client: AsyncClient, headers: dict, **extra):
    return await client.post(
        "/api/v1/support/tickets",
        headers=headers,
        json={"category": "turno", "subject": "Algo pasó", "body": "Les cuento.", **extra},
    )


async def test_ticket_without_reference_works_as_always(client: AsyncClient):
    worker, _ = await _worker_with_profile(client, "sref_w0@staffya.com")
    created = await _ticket(client, worker)
    assert created.status_code == 201
    assert created.json()["shift_id"] is None
    assert created.json()["company_id"] is None
    detail = await client.get(f"/api/v1/support/tickets/{created.json()['id']}", headers=worker)
    assert detail.json()["references"] == {"shift": None, "company": None}


async def test_worker_ties_a_public_open_shift_and_its_company(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e1@staffya.com")
    shift_id = await _published_shift(client, employer)
    company_id = await _company_id(client, employer)
    worker, _ = await _worker_with_profile(client, "sref_w1@staffya.com")

    created = await _ticket(client, worker, shift_id=shift_id)

    assert created.status_code == 201
    body = created.json()
    assert body["shift_id"] == shift_id
    # El comercio se completa solo con el del turno.
    assert body["company_id"] == company_id
    detail = (await client.get(f"/api/v1/support/tickets/{body['id']}", headers=worker)).json()
    assert detail["references"]["shift"]["title"] == "Mozo para el sábado"
    assert detail["references"]["company"]["id"] == company_id
    # La cuenta dueña del comercio sólo la ve el admin.
    assert detail["references"]["company"]["user_id"] is None


async def test_worker_who_applied_can_tie_a_shift_that_is_no_longer_open(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e2@staffya.com")
    shift_id = await _published_shift(client, employer)
    applicant, _ = await _worker_with_profile(client, "sref_w2a@staffya.com")
    chosen, chosen_profile = await _worker_with_profile(client, "sref_w2b@staffya.com")
    stranger, _ = await _worker_with_profile(client, "sref_w2c@staffya.com")
    for headers in (applicant, chosen):
        assert (
            await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=headers)
        ).status_code == 201
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": chosen_profile},
    )
    assert assigned.status_code == 200

    # El turno ya tiene a alguien asignado: no lo ve cualquiera...
    assert (await _ticket(client, stranger, shift_id=shift_id)).status_code == 404
    # ...pero sí quien se postuló y quien quedó asignado.
    assert (await _ticket(client, applicant, shift_id=shift_id)).status_code == 201
    assert (await _ticket(client, chosen, shift_id=shift_id)).status_code == 201


async def test_nonexistent_and_foreign_shift_give_the_same_404(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e3@staffya.com")
    other_employer = await _employer_with_company(client, "sref_e3b@staffya.com")
    shift_id = await _published_shift(client, employer)
    # Turno ajeno y ya no abierto: la cuenta del comercio se cancela el turno.
    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)
    assert cancelled.status_code == 200
    worker, _ = await _worker_with_profile(client, "sref_w3@staffya.com")

    foreign = await _ticket(client, worker, shift_id=shift_id)
    missing = await _ticket(client, worker, shift_id=str(uuid.uuid4()))
    foreign_by_employer = await _ticket(client, other_employer, shift_id=shift_id)

    assert foreign.status_code == missing.status_code == foreign_by_employer.status_code == 404
    assert foreign.json() == missing.json() == foreign_by_employer.json()


async def test_employer_ties_own_shift_but_not_someone_elses_open_one(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e4@staffya.com")
    other_employer = await _employer_with_company(client, "sref_e4b@staffya.com")
    shift_id = await _published_shift(client, employer)

    assert (await _ticket(client, employer, shift_id=shift_id)).status_code == 201
    # Un turno abierto público lo ve un trabajador, no un comercio ajeno.
    assert (await _ticket(client, other_employer, shift_id=shift_id)).status_code == 404


async def test_company_reference_rules(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e5@staffya.com")
    quiet_employer = await _employer_with_company(client, "sref_e5b@staffya.com")
    await _published_shift(client, employer)
    company_id = await _company_id(client, employer)
    quiet_company_id = await _company_id(client, quiet_employer)
    worker, _ = await _worker_with_profile(client, "sref_w5@staffya.com")

    # El trabajador ve un turno abierto de ese comercio: puede atarlo.
    created = await _ticket(client, worker, company_id=company_id, category="comercio")
    assert created.status_code == 201
    assert created.json()["company_id"] == company_id
    assert created.json()["shift_id"] is None
    # Un comercio sin ningún turno relacionado con él: 404.
    assert (await _ticket(client, worker, company_id=quiet_company_id)).status_code == 404
    # Un comercio ata el suyo, no el de otro.
    assert (await _ticket(client, employer, company_id=company_id)).status_code == 201
    assert (await _ticket(client, employer, company_id=quiet_company_id)).status_code == 404
    assert (await _ticket(client, worker, company_id=str(uuid.uuid4()))).status_code == 404


async def test_company_that_does_not_match_the_shift_is_rejected(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e6@staffya.com")
    other_employer = await _employer_with_company(client, "sref_e6b@staffya.com")
    shift_id = await _published_shift(client, employer)
    other_company_id = await _company_id(client, other_employer)
    await _published_shift(client, other_employer)
    worker, _ = await _worker_with_profile(client, "sref_w6@staffya.com")

    mismatch = await _ticket(client, worker, shift_id=shift_id, company_id=other_company_id)

    assert mismatch.status_code == 404


async def test_reference_endpoint_previews_what_will_be_tied(client: AsyncClient):
    employer = await _employer_with_company(client, "sref_e7@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "sref_w7@staffya.com")

    ok = await client.get(f"/api/v1/support/reference?shift_id={shift_id}", headers=worker)
    assert ok.status_code == 200
    assert ok.json()["shift"]["id"] == shift_id
    assert ok.json()["shift"]["title"] == "Mozo para el sábado"

    nope = await client.get(f"/api/v1/support/reference?shift_id={uuid.uuid4()}", headers=worker)
    assert nope.status_code == 404


async def test_admin_sees_the_reference_with_the_company_account(
    client: AsyncClient, session_factory
):
    employer = await _employer_with_company(client, "sref_e8@staffya.com")
    shift_id = await _published_shift(client, employer)
    worker, _ = await _worker_with_profile(client, "sref_w8@staffya.com")
    created = (await _ticket(client, worker, shift_id=shift_id)).json()
    admin = await _make_admin(client, session_factory, "sref_admin@staffya.com")

    detail = (
        await client.get(f"/api/v1/support/tickets/{created['id']}", headers=admin)
    ).json()
    assert detail["references"]["shift"]["id"] == shift_id
    assert detail["references"]["company"]["user_id"] is not None

    listed = (await client.get("/api/v1/support/tickets", headers=admin)).json()
    row = next(t for t in listed if t["id"] == created["id"])
    assert row["shift_id"] == shift_id
    assert row["shift_title"] == "Mozo para el sábado"
    assert row["company_name"] == "Bar Palermo"
