"""Tests del resumen de ganancias del trabajador (pedido de Julieta: "un
resumen de ganancias acumuladas en el perfil ... por mes")."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

PALERMO = {"latitude": -34.58, "longitude": -58.43}


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _two_months_ago() -> datetime:
    # Resta ~60 días en vez de tocar el campo `month` a mano: evita líos de
    # fin de mes (ej. 31/8 - 2 meses no es un día válido en algunos meses).
    return _now_naive() - timedelta(days=60)


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", **PALERMO},
    )
    return headers


async def _worker_with_profile(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"], **PALERMO},
    )
    return headers, profile.json()["id"]


async def _finish_shift(
    client: AsyncClient,
    employer: dict,
    worker: dict,
    worker_id: str,
    *,
    start_at: datetime,
    pay_amount: str,
    mark_paid: bool = False,
) -> str:
    """Publica un turno, lo asigna y lo lleva hasta FINALIZADO (o PAGADO si
    `mark_paid`), igual que `test_favorite.py::test_shifts_together_...`."""
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": start_at.isoformat(),
            "end_at": (start_at + timedelta(hours=5)).isoformat(),
            "pay_amount": pay_amount,
            "city": "Palermo",
            **PALERMO,
        },
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=worker, json=PALERMO)
    await client.post(f"/api/v1/shifts/{shift_id}/start-working", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=PALERMO)
    await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    if mark_paid:
        await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer)
    return shift_id


async def test_earnings_summary_starts_at_zero(client: AsyncClient):
    worker, _worker_id = await _worker_with_profile(client, "earn_w1@staffya.com")

    response = await client.get("/api/v1/workers/me/earnings", headers=worker)
    assert response.status_code == 200
    body = response.json()
    assert body["total_earned"] == "0"
    assert body["this_month_earned"] == "0"
    assert body["shifts_completed"] == 0


async def test_earnings_counts_finalizado_and_pagado_shifts(client: AsyncClient):
    employer = await _employer_with_company(client, "earn_emp2@staffya.com")
    worker, worker_id = await _worker_with_profile(client, "earn_w2@staffya.com")

    now = _now_naive()
    await _finish_shift(
        client, employer, worker, worker_id, start_at=now, pay_amount="50000.00"
    )
    await _finish_shift(
        client,
        employer,
        worker,
        worker_id,
        start_at=now,
        pay_amount="30000.00",
        mark_paid=True,
    )

    response = await client.get("/api/v1/workers/me/earnings", headers=worker)
    body = response.json()
    assert body["total_earned"] == "80000.00"
    assert body["shifts_completed"] == 2


async def test_earnings_excludes_open_and_cancelled_shifts(client: AsyncClient):
    employer = await _employer_with_company(client, "earn_emp3@staffya.com")
    worker, worker_id = await _worker_with_profile(client, "earn_w3@staffya.com")

    now = _now_naive()
    # Turno publicado, nunca asignado: no es un ingreso todavía.
    await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(hours=5)).isoformat(),
            "pay_amount": "99999.00",
            "city": "Palermo",
            **PALERMO,
        },
    )
    # Turno asignado y luego cancelado: tampoco cuenta.
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(hours=5)).isoformat(),
            "pay_amount": "88888.00",
            "city": "Palermo",
            **PALERMO,
        },
    )
    cancelled_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{cancelled_id}/publish", headers=employer)
    await client.post(
        f"/api/v1/shifts/{cancelled_id}/assign",
        headers=employer,
        json={"worker_profile_id": worker_id},
    )
    await client.post(f"/api/v1/shifts/{cancelled_id}/cancel", headers=employer)

    response = await client.get("/api/v1/workers/me/earnings", headers=worker)
    body = response.json()
    assert body["total_earned"] == "0"
    assert body["shifts_completed"] == 0


async def test_earnings_this_month_only_counts_current_month(client: AsyncClient):
    employer = await _employer_with_company(client, "earn_emp4@staffya.com")
    worker, worker_id = await _worker_with_profile(client, "earn_w4@staffya.com")

    await _finish_shift(
        client,
        employer,
        worker,
        worker_id,
        start_at=_now_naive(),
        pay_amount="40000.00",
    )
    await _finish_shift(
        client,
        employer,
        worker,
        worker_id,
        start_at=_two_months_ago(),
        pay_amount="60000.00",
    )

    response = await client.get("/api/v1/workers/me/earnings", headers=worker)
    body = response.json()
    assert body["total_earned"] == "100000.00"
    assert body["this_month_earned"] == "40000.00"
    assert body["shifts_completed"] == 2


async def test_earnings_require_worker_profile(client: AsyncClient):
    worker = await auth_headers(client, "worker", "earn_w5@staffya.com")

    response = await client.get("/api/v1/workers/me/earnings", headers=worker)
    assert response.status_code == 404


async def test_employer_cannot_access_worker_earnings(client: AsyncClient):
    employer = await _employer_with_company(client, "earn_emp6@staffya.com")

    response = await client.get("/api/v1/workers/me/earnings", headers=employer)
    assert response.status_code == 403
