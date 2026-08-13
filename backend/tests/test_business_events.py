"""Tests de los business events de negocio (shift/application), instrumentados
sobre el logger que ya existía en cada servicio de aplicación — ver
docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md §5.

No verifican el JSON final (eso lo cubre `test_observability.py`), sino que
cada transición real del dominio efectivamente loguea su evento con los
campos esperados, vía `caplog` (fixture estándar de pytest)."""

import logging

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return headers, profile.json()["id"]


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


_BUSINESS_EVENT_LOGGERS = (
    "app.modules.shift.application.services",
    "app.modules.application.application.services",
)


def _events(caplog: pytest.LogCaptureFixture) -> list[str]:
    """Mensajes de los business events emitidos (excluye ruido de otros
    loggers, p. ej. SQLAlchemy si `echo` estuviera prendido)."""
    return [r.message for r in caplog.records if r.name in _BUSINESS_EVENT_LOGGERS]


async def test_publish_shift_logs_shift_published(client: AsyncClient, caplog):
    caplog.set_level(logging.INFO)
    employer = await _employer_with_company(client, "emp_evt_pub@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]

    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    events = _events(caplog)
    assert "shift.published" in events
    record = next(r for r in caplog.records if r.message == "shift.published")
    assert record.shift_id == shift_id
    assert record.company_id


async def test_apply_and_assign_log_full_chain(client: AsyncClient, caplog):
    """Cadena completa: postularse -> asignar -> se aceptan/rechazan
    postulaciones. Un solo turno con dos postulantes ejercita los 4 eventos
    del flujo de asignación en una corrida."""
    caplog.set_level(logging.INFO)
    employer = await _employer_with_company(client, "emp_evt_chain@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    worker1, worker1_id = await _worker_with_profile(client, "w_evt_chain1@staffya.com")
    worker2, worker2_id = await _worker_with_profile(client, "w_evt_chain2@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker1)
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker2)

    caplog.clear()
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker1_id},
    )

    events = _events(caplog)
    assert "shift.assigned" in events
    assert "application.accepted" in events
    assert "application.rejected" in events

    assigned = next(r for r in caplog.records if r.message == "shift.assigned")
    assert assigned.worker_profile_id == worker1_id

    accepted = next(r for r in caplog.records if r.message == "application.accepted")
    assert accepted.worker_profile_id == worker1_id

    rejected = next(r for r in caplog.records if r.message == "application.rejected")
    assert rejected.count == 1  # sólo worker2 quedaba PENDIENTE


async def test_apply_logs_application_submitted(client: AsyncClient, caplog):
    caplog.set_level(logging.INFO)
    employer = await _employer_with_company(client, "emp_evt_apply@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, worker_id = await _worker_with_profile(client, "w_evt_apply@staffya.com")

    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)

    events = _events(caplog)
    assert "application.submitted" in events
    record = next(r for r in caplog.records if r.message == "application.submitted")
    assert record.shift_id == shift_id
    assert record.worker_profile_id == worker_id


async def test_withdraw_logs_application_withdrawn(client: AsyncClient, caplog):
    employer = await _employer_with_company(client, "emp_evt_withdraw@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, worker_id = await _worker_with_profile(client, "w_evt_withdraw@staffya.com")
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    application_id = applied.json()["id"]

    caplog.clear()
    caplog.set_level(logging.INFO)
    await client.post(f"/api/v1/applications/{application_id}/withdraw", headers=worker)

    events = _events(caplog)
    assert "application.withdrawn" in events
    record = next(r for r in caplog.records if r.message == "application.withdrawn")
    assert record.worker_profile_id == worker_id


async def test_cancel_shift_logs_shift_cancelled(client: AsyncClient, caplog):
    caplog.set_level(logging.INFO)
    employer = await _employer_with_company(client, "emp_evt_cancel@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    caplog.clear()
    await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=employer)

    events = _events(caplog)
    assert "shift.cancelled" in events
    record = next(r for r in caplog.records if r.message == "shift.cancelled")
    assert record.shift_id == shift_id
    assert record.was_committed is False


async def test_mark_no_show_logs_worker_no_show_with_manual_trigger(
    client: AsyncClient, caplog
):
    caplog.set_level(logging.INFO)
    employer = await _employer_with_company(client, "emp_evt_noshow@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, worker_id = await _worker_with_profile(client, "w_evt_noshow@staffya.com")
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)

    caplog.clear()
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer)

    events = _events(caplog)
    assert "worker.no_show" in events
    record = next(r for r in caplog.records if r.message == "worker.no_show")
    assert record.worker_profile_id == worker_id
    assert record.trigger == "manual"
