"""Tests de integración del módulo saved_shift (el trabajador guarda turnos
abiertos para evaluarlos después, sin postularse todavía — pedido de
Julieta: "así comienza algo más de evaluar opciones que convengan")."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

PALERMO = {"latitude": -34.58, "longitude": -58.43}


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


async def _published_shift(
    client: AsyncClient, employer: dict, *, position: str = "mozo", start_at: datetime
) -> str:
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json={
            "position": position,
            "quantity": 1,
            "start_at": start_at.isoformat(),
            "end_at": (start_at + timedelta(hours=5)).isoformat(),
            "pay_amount": "70000.00",
            "city": "Palermo",
            **PALERMO,
        },
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    return shift_id


async def test_save_and_list_shift(client: AsyncClient):
    employer = await _employer_with_company(client, "sav_emp1@staffya.com")
    worker, _worker_id = await _worker_with_profile(client, "sav_w1@staffya.com")
    shift_id = await _published_shift(client, employer, start_at=_now_naive() + timedelta(days=1))

    saved = await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    assert saved.status_code == 200
    assert saved.json()["is_saved"] is True

    listed = await client.get("/api/v1/saved-shifts", headers=worker)
    assert listed.status_code == 200
    body = listed.json()
    assert len(body) == 1
    assert body[0]["id"] == shift_id
    assert body[0]["company_name"] == "Bar Palermo"


async def test_save_is_idempotent(client: AsyncClient):
    employer = await _employer_with_company(client, "sav_emp2@staffya.com")
    worker, _worker_id = await _worker_with_profile(client, "sav_w2@staffya.com")
    shift_id = await _published_shift(client, employer, start_at=_now_naive() + timedelta(days=1))

    await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    second = await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    assert second.status_code == 200

    listed = await client.get("/api/v1/saved-shifts", headers=worker)
    assert len(listed.json()) == 1


async def test_unsave_removes_shift_and_is_idempotent(client: AsyncClient):
    employer = await _employer_with_company(client, "sav_emp3@staffya.com")
    worker, _worker_id = await _worker_with_profile(client, "sav_w3@staffya.com")
    shift_id = await _published_shift(client, employer, start_at=_now_naive() + timedelta(days=1))

    await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    removed = await client.delete(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    assert removed.status_code == 200
    assert removed.json()["is_saved"] is False

    listed = await client.get("/api/v1/saved-shifts", headers=worker)
    assert listed.json() == []

    # Sacar de nuevo (ya no estaba guardado) no falla: idempotente.
    again = await client.delete(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    assert again.status_code == 200


async def test_saved_shift_status_endpoint(client: AsyncClient):
    employer = await _employer_with_company(client, "sav_emp4@staffya.com")
    worker, _worker_id = await _worker_with_profile(client, "sav_w4@staffya.com")
    shift_id = await _published_shift(client, employer, start_at=_now_naive() + timedelta(days=1))

    before = await client.get(f"/api/v1/saved-shifts/{shift_id}/status", headers=worker)
    assert before.json()["is_saved"] is False

    await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=worker)
    after = await client.get(f"/api/v1/saved-shifts/{shift_id}/status", headers=worker)
    assert after.json()["is_saved"] is True


async def test_saved_shifts_are_private_per_worker(client: AsyncClient):
    employer = await _employer_with_company(client, "sav_emp5@staffya.com")
    worker_a, _ = await _worker_with_profile(client, "sav_w5a@staffya.com")
    worker_b, _ = await _worker_with_profile(client, "sav_w5b@staffya.com")
    shift_id = await _published_shift(client, employer, start_at=_now_naive() + timedelta(days=1))

    await client.put(f"/api/v1/saved-shifts/{shift_id}", headers=worker_a)

    listed_b = await client.get("/api/v1/saved-shifts", headers=worker_b)
    assert listed_b.json() == []
    status_b = await client.get(f"/api/v1/saved-shifts/{shift_id}/status", headers=worker_b)
    assert status_b.json()["is_saved"] is False


async def test_save_nonexistent_shift_returns_404(client: AsyncClient):
    worker, _worker_id = await _worker_with_profile(client, "sav_w6@staffya.com")
    fake_shift_id = "00000000-0000-0000-0000-000000000000"

    response = await client.put(f"/api/v1/saved-shifts/{fake_shift_id}", headers=worker)
    assert response.status_code == 404


async def test_employer_role_cannot_access_saved_shifts(client: AsyncClient):
    employer = await _employer_with_company(client, "sav_emp7@staffya.com")

    response = await client.get("/api/v1/saved-shifts", headers=employer)
    assert response.status_code == 403


async def test_list_orders_by_shift_date_not_by_when_saved(client: AsyncClient):
    """Pedido explícito de Julieta: "guardar turnos ordenados por fecha" — el
    orden es por CUÁNDO ES el turno (el más próximo primero), no por cuándo
    se guardó, para que sirva para planificar."""
    employer = await _employer_with_company(client, "sav_emp8@staffya.com")
    worker, _worker_id = await _worker_with_profile(client, "sav_w8@staffya.com")

    now = _now_naive()
    shift_far = await _published_shift(client, employer, start_at=now + timedelta(days=10))
    shift_near = await _published_shift(client, employer, start_at=now + timedelta(days=1))
    shift_mid = await _published_shift(client, employer, start_at=now + timedelta(days=5))

    # Se guardan en orden "lejos, cerca, medio" — a propósito, distinto del
    # orden esperado en la respuesta, para probar que no ordena por
    # `created_at` del guardado.
    await client.put(f"/api/v1/saved-shifts/{shift_far}", headers=worker)
    await client.put(f"/api/v1/saved-shifts/{shift_near}", headers=worker)
    await client.put(f"/api/v1/saved-shifts/{shift_mid}", headers=worker)

    listed = await client.get("/api/v1/saved-shifts", headers=worker)
    ids = [s["id"] for s in listed.json()]
    assert ids == [shift_near, shift_mid, shift_far]
