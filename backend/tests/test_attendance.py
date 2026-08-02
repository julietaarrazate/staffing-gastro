"""Tests del flujo de asistencia geolocalizada (en_camino → ... → pagado)."""

from datetime import datetime, timedelta, timezone

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
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"]},
    )
    return headers, profile.json()["id"]


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "tips": True,
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def _confirmed_shift(
    client: AsyncClient, emp_email: str, worker_email: str, **shift_overrides
):
    employer_headers = await _employer_with_company(client, emp_email)
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload(**shift_overrides)
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(client, worker_email)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
    return shift_id, employer_headers, worker_headers


async def test_full_attendance_flow(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp1@staffya.com", "att_w1@staffya.com"
    )

    departed = await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    assert departed.status_code == 200
    assert departed.json()["status"] == "en_camino"

    checked_in = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert checked_in.status_code == 200
    body = checked_in.json()
    assert body["status"] == "check_in"
    assert body["check_in_latitude"] == -34.58
    assert body["check_in_longitude"] == -58.43
    assert body["check_in_at"] is not None

    started = await client.post(
        f"/api/v1/shifts/{shift_id}/start-working", headers=worker_headers
    )
    assert started.status_code == 200
    assert started.json()["status"] == "trabajando"

    checked_out = await client.post(
        f"/api/v1/shifts/{shift_id}/check-out",
        headers=worker_headers,
        json={"latitude": -34.59, "longitude": -58.44},
    )
    assert checked_out.status_code == 200
    body = checked_out.json()
    assert body["status"] == "check_out"
    assert body["check_out_latitude"] == -34.59
    assert body["check_out_at"] is not None

    # El comercio recibe una notificación cuando el trabajador termina.
    notifications = await client.get("/api/v1/notifications", headers=employer_headers)
    assert any(n["type"] == "shift_checked_out" for n in notifications.json())

    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)
    assert finished.status_code == 200
    assert finished.json()["status"] == "finalizado"

    paid = await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer_headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "pagado"
    assert paid.json()["paid_at"] is not None

    # El trabajador recibe una notificación cuando se le paga.
    worker_notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "shift_paid" for n in worker_notifications.json())


async def test_check_in_directly_from_confirmado(client: AsyncClient):
    """ADR-0008: el flujo de asistencia bajó de 4 pasos a 2 — se puede
    marcar llegada directo desde CONFIRMADO, sin pasar por `depart()`
    (EN_CAMINO) primero."""
    shift_id, _employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp2@staffya.com", "att_w2@staffya.com"
    )
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "check_in"


async def test_check_in_still_works_after_legacy_depart(client: AsyncClient):
    """`depart()` (EN_CAMINO) queda como paso opcional/legacy — el check-in
    lo sigue aceptando como estado previo, para no romper turnos que ya
    estaban a mitad de camino cuando se desplegó ADR-0008."""
    shift_id, _employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp2b@staffya.com", "att_w2b@staffya.com"
    )
    departed = await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    assert departed.status_code == 200
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    assert response.status_code == 200


async def test_check_out_directly_from_check_in(client: AsyncClient):
    """Mismo criterio que el check-in: `check_out()` va directo desde
    CHECK_IN, sin exigir `start_working()` (TRABAJANDO) primero."""
    shift_id, _employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp2c@staffya.com", "att_w2c@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/check-out",
        headers=worker_headers,
        json={"latitude": -34.59, "longitude": -58.44},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "check_out"


async def test_other_worker_cannot_depart_someone_elses_shift(client: AsyncClient):
    shift_id, _employer_headers, _worker_headers = await _confirmed_shift(
        client, "att_emp3@staffya.com", "att_w3@staffya.com"
    )
    other_headers, _ = await _worker_with_profile(client, "att_w_other@staffya.com")
    response = await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=other_headers)
    assert response.status_code == 404


async def test_employer_cannot_finish_before_check_out(client: AsyncClient):
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client, "att_emp4@staffya.com", "att_w4@staffya.com"
    )
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    response = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)
    assert response.status_code == 400


async def _run_full_flow_to_finish(
    client: AsyncClient, shift_id: str, employer_headers: dict, worker_headers: dict
) -> None:
    """Corre depart → check-in → start-working → check-out → finish."""
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )
    await client.post(f"/api/v1/shifts/{shift_id}/start-working", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-out",
        headers=worker_headers,
        json={"latitude": -34.59, "longitude": -58.44},
    )
    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)
    assert finished.status_code == 200


async def test_finish_with_punctual_checkin_updates_worker_metrics(client: AsyncClient):
    """R2.4: check-in dentro de la tolerancia (±15 min) del horario pactado
    suma un evento completado y deja punctuality_rate en 1.0 (primer evento)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client,
        "att_emp5@staffya.com",
        "att_w5@staffya.com",
        start_at=now.isoformat(),
        end_at=(now + timedelta(hours=5)).isoformat(),
    )

    await _run_full_flow_to_finish(client, shift_id, employer_headers, worker_headers)

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert profile.status_code == 200
    body = profile.json()
    assert body["events_completed"] == 1
    assert body["punctuality_rate"] == pytest.approx(1.0)


async def test_publish_increments_company_events_published(client: AsyncClient):
    """Reputación del comercio (docs/REPUTATION.md): antes `events_published`
    quedaba en 0 para siempre, sin cálculo automático."""
    employer_headers = await _employer_with_company(client, "att_emp7@staffya.com")
    for _ in range(2):
        created = await client.post(
            "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
        )
        await client.post(
            f"/api/v1/shifts/{created.json()['id']}/publish", headers=employer_headers
        )

    profile = await client.get("/api/v1/companies/me/profile", headers=employer_headers)
    assert profile.status_code == 200
    assert profile.json()["events_published"] == 2


async def test_mark_paid_on_time_and_late_updates_company_rate(client: AsyncClient):
    """Reputación del comercio: `on_time_payment_rate` es un promedio móvil
    sobre si `mark_paid` ocurrió dentro de `PAYMENT_TOLERANCE` (48hs) desde
    `end_at`. Antes quedaba en 0 para siempre, sin cálculo automático."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Turno 1: se paga "ahora", su fin fue hace 2hs → a tiempo.
    on_time_shift, employer_headers, worker_headers_1 = await _confirmed_shift(
        client,
        "att_emp8@staffya.com",
        "att_w8@staffya.com",
        start_at=(now - timedelta(hours=7)).isoformat(),
        end_at=(now - timedelta(hours=2)).isoformat(),
    )
    await _run_full_flow_to_finish(client, on_time_shift, employer_headers, worker_headers_1)
    paid_on_time = await client.post(
        f"/api/v1/shifts/{on_time_shift}/mark-paid", headers=employer_headers
    )
    assert paid_on_time.status_code == 200

    profile = await client.get("/api/v1/companies/me/profile", headers=employer_headers)
    assert profile.json()["on_time_payment_rate"] == pytest.approx(1.0)

    # Turno 2 (mismo comercio): se paga "ahora", su fin fue hace 50hs (fuera
    # de la tolerancia de 48hs) → tarde. Promedio: (1.0 + 0.0) / 2 = 0.5.
    late_shift, _, worker_headers_2 = await _confirmed_shift(
        client,
        "att_emp8@staffya.com",
        "att_w9@staffya.com",
        start_at=(now - timedelta(hours=55)).isoformat(),
        end_at=(now - timedelta(hours=50)).isoformat(),
    )
    await _run_full_flow_to_finish(client, late_shift, employer_headers, worker_headers_2)
    paid_late = await client.post(
        f"/api/v1/shifts/{late_shift}/mark-paid", headers=employer_headers
    )
    assert paid_late.status_code == 200

    profile = await client.get("/api/v1/companies/me/profile", headers=employer_headers)
    assert profile.json()["on_time_payment_rate"] == pytest.approx(0.5)


async def test_badges_and_level_recompute_after_finish_and_worker_cancel(
    client: AsyncClient,
):
    """ADR-0004: `badges`/`level` se recalculan en los mismos puntos donde ya
    se actualizan `events_completed`/`punctuality_rate` (al finalizar un
    turno, R2.4) y también al registrar una cancelación del trabajador."""
    employer_headers = await _employer_with_company(client, "att_badges_emp@staffya.com")
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "att_badges_w@staffya.com"
    )
    # Este test publica 4 turnos para el mismo comercio, por encima del tope
    # del plan gratis (3/mes, ADR-0005 Fase 1); se sube a `pro` (ilimitado)
    # para no acoplar este test de reputación al gating de capacidad.
    await client.post(
        "/api/v1/subscription/subscribe",
        headers=employer_headers,
        json={"plan_code": "pro"},
    )

    async def _create_confirmed_shift(city: str) -> str:
        created = await client.post(
            "/api/v1/shifts", headers=employer_headers, json=_shift_payload(city=city)
        )
        shift_id = created.json()["id"]
        await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
        await client.post(
            f"/api/v1/shifts/{shift_id}/assign",
            headers=employer_headers,
            json={"worker_profile_id": worker_profile_id},
        )
        await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker_headers)
        return shift_id

    # Tres turnos finalizados sin cancelaciones alcanzan `nunca_falto`
    # (0 cancelaciones, >= 3 eventos completados).
    for i in range(3):
        shift_id = await _create_confirmed_shift(f"BadgesCity{i}")
        await _run_full_flow_to_finish(client, shift_id, employer_headers, worker_headers)

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    body = profile.json()
    assert body["events_completed"] == 3
    assert "nunca_falto" in body["badges"]

    # Un cuarto turno confirmado que el trabajador cancela suma una
    # cancelación y le hace perder `nunca_falto` (recalculado desde cero,
    # sin histéresis).
    shift_id = await _create_confirmed_shift("BadgesCity3")
    cancelled = await client.post(
        f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker_headers
    )
    assert cancelled.status_code == 200

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    body = profile.json()
    assert body["cancellations"] == 1
    assert "nunca_falto" not in body["badges"]


async def test_finish_with_late_checkin_does_not_count_as_punctual(client: AsyncClient):
    """R2.4: check-in muy posterior al horario pactado (fuera de tolerancia)
    suma el evento completado pero no cuenta como puntual (rate en 0.0)."""
    late_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
    shift_id, employer_headers, worker_headers = await _confirmed_shift(
        client,
        "att_emp6@staffya.com",
        "att_w6@staffya.com",
        start_at=late_start.isoformat(),
        end_at=(late_start + timedelta(hours=5)).isoformat(),
    )

    await _run_full_flow_to_finish(client, shift_id, employer_headers, worker_headers)

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert profile.status_code == 200
    body = profile.json()
    assert body["events_completed"] == 1
    assert body["punctuality_rate"] == pytest.approx(0.0)
