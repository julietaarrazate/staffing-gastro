"""Tests de integración de PRIMER_TURNO_REAL_SPEC — Parte C (ADR-0007).

No-show del trabajador (marcado manual por el comercio, turno en marcha) y
cancelación tardía del comercio (trabajador ya confirmado). Ninguno de los
dos lazos existía antes de este batch: se recorren de punta a punta, no sólo
en unidades sueltas.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Bar Palermo")
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
    return shift_id, employer_headers, worker_headers, worker_profile_id


# --- No-show ----------------------------------------------------------------


async def test_no_show_from_confirmed_reopens_shift_and_records_reputation(
    client: AsyncClient,
):
    shift_id, employer_headers, worker_headers, worker_profile_id = await _confirmed_shift(
        client, "ns_emp1@staffya.com", "ns_w1@staffya.com", city="NoShowCity1"
    )

    marked = await client.post(
        f"/api/v1/shifts/{shift_id}/no-show", headers=employer_headers
    )
    assert marked.status_code == 200
    body = marked.json()
    # (a) libera el turno para re-buscar.
    assert body["status"] == "buscando_personal"
    assert body["worker_profile_id"] is None
    # (c) queda registrado en el propio turno (auditable).
    assert body["no_show_at"] is not None
    assert body["last_no_show_worker_profile_id"] == worker_profile_id

    # Reaparece en el feed para re-buscar.
    feed = await client.get(
        "/api/v1/shifts/feed", headers=employer_headers, params={"city": "NoShowCity1"}
    )
    assert any(s["id"] == shift_id for s in feed.json())

    # (b) impacta la reputación del trabajador de forma trazable (no un
    # UPDATE a mano: pasa por WorkerProfileRepository.record_no_show).
    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert profile.json()["no_shows"] == 1
    assert profile.json()["cancellations"] == 0  # no se mezcla con cancellations

    # El trabajador se entera (in-app, y push best-effort si aplica).
    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "shift_no_show" for n in notifications.json())


async def test_no_show_from_en_camino_also_allowed(client: AsyncClient):
    shift_id, employer_headers, worker_headers, _ = await _confirmed_shift(
        client, "ns_emp2@staffya.com", "ns_w2@staffya.com"
    )
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)

    marked = await client.post(
        f"/api/v1/shifts/{shift_id}/no-show", headers=employer_headers
    )
    assert marked.status_code == 200
    assert marked.json()["status"] == "buscando_personal"


async def test_no_show_rejected_before_confirmation(client: AsyncClient):
    """Sólo desde CONFIRMADO/EN_CAMINO: en ASIGNADO el comercio todavía puede
    reasignar directo, no hay "no-show" que marcar."""
    employer_headers = await _employer_with_company(client, "ns_emp3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "ns_w3@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )

    response = await client.post(
        f"/api/v1/shifts/{shift_id}/no-show", headers=employer_headers
    )
    assert response.status_code == 400


async def test_no_show_rejected_after_check_in(client: AsyncClient):
    """Una vez que hizo check-in, ya se presentó: no aplica no-show."""
    shift_id, employer_headers, worker_headers, _ = await _confirmed_shift(
        client, "ns_emp4@staffya.com", "ns_w4@staffya.com"
    )
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker_headers)
    await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=worker_headers,
        json={"latitude": -34.58, "longitude": -58.43},
    )

    response = await client.post(
        f"/api/v1/shifts/{shift_id}/no-show", headers=employer_headers
    )
    assert response.status_code == 400


async def test_other_company_cannot_mark_no_show(client: AsyncClient):
    shift_id, _employer_headers, _worker_headers, _ = await _confirmed_shift(
        client, "ns_emp5@staffya.com", "ns_w5@staffya.com"
    )
    other_headers = await _employer_with_company(client, "ns_emp5_other@staffya.com")
    response = await client.post(
        f"/api/v1/shifts/{shift_id}/no-show", headers=other_headers
    )
    assert response.status_code == 404


async def test_no_show_breaks_nunca_falto_badge(client: AsyncClient):
    """ADR-0007: un no-show rompe `nunca_falto` igual que una cancelación
    (recalculado desde cero, sin histéresis — mismo patrón que ADR-0004)."""
    employer_headers = await _employer_with_company(client, "ns_badges_emp@staffya.com")
    await client.post(
        "/api/v1/subscription/subscribe", headers=employer_headers, json={"plan_code": "pro"}
    )
    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "ns_badges_w@staffya.com"
    )

    async def _run_full_flow_to_finish(shift_id: str) -> None:
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
        await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer_headers)

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

    for i in range(3):
        shift_id = await _create_confirmed_shift(f"NoShowBadgesCity{i}")
        await _run_full_flow_to_finish(shift_id)

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    assert "nunca_falto" in profile.json()["badges"]

    shift_id = await _create_confirmed_shift("NoShowBadgesCity3")
    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=employer_headers)
    assert marked.status_code == 200

    profile = await client.get("/api/v1/workers/me/profile", headers=worker_headers)
    body = profile.json()
    assert body["no_shows"] == 1
    assert "nunca_falto" not in body["badges"]


# --- Cancelación tardía del comercio -----------------------------------------


async def test_late_cancellation_notifies_worker_and_costs_company_reputation(
    client: AsyncClient,
):
    shift_id, employer_headers, worker_headers, _ = await _confirmed_shift(
        client, "lc_emp1@staffya.com", "lc_w1@staffya.com"
    )

    company_before = await client.get(
        "/api/v1/companies/me/profile", headers=employer_headers
    )
    assert company_before.json()["late_cancellations"] == 0

    cancelled = await client.post(
        f"/api/v1/shifts/{shift_id}/cancel", headers=employer_headers
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelado"

    # Efecto simétrico: le cuesta reputación al comercio (trazable, no
    # UPDATE a mano: CompanyProfileRepository.record_late_cancellation).
    company_after = await client.get(
        "/api/v1/companies/me/profile", headers=employer_headers
    )
    assert company_after.json()["late_cancellations"] == 1

    # Hallazgo del batch: antes de este ADR, esto no avisaba nada al
    # trabajador. Ahora sí, in-app (+ push best-effort si aplica).
    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert any(n["type"] == "shift_cancelled_late" for n in notifications.json())


async def test_cancellation_before_confirmation_is_not_late(client: AsyncClient):
    """Cancelar un turno todavía sin confirmar (p. ej. recién asignado, o ni
    siquiera eso) no es "tardía": el trabajador nunca llegó a comprometerse."""
    employer_headers = await _employer_with_company(client, "lc_emp2@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)

    worker_headers, worker_profile_id = await _worker_with_profile(
        client, "lc_w2@staffya.com"
    )
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer_headers,
        json={"worker_profile_id": worker_profile_id},
    )
    # Todavía en ASIGNADO (el trabajador no confirmó).
    cancelled = await client.post(
        f"/api/v1/shifts/{shift_id}/cancel", headers=employer_headers
    )
    assert cancelled.status_code == 200

    company_profile = await client.get(
        "/api/v1/companies/me/profile", headers=employer_headers
    )
    assert company_profile.json()["late_cancellations"] == 0

    notifications = await client.get("/api/v1/notifications", headers=worker_headers)
    assert not any(n["type"] == "shift_cancelled_late" for n in notifications.json())


async def test_cancellation_of_draft_shift_is_not_late(client: AsyncClient):
    """Cancelar un turno en borrador (sin nadie asignado) no dispara ningún
    efecto de reputación ni notificación — no hay a quién avisar."""
    employer_headers = await _employer_with_company(client, "lc_emp3@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer_headers, json=_shift_payload()
    )
    shift_id = created.json()["id"]

    cancelled = await client.post(
        f"/api/v1/shifts/{shift_id}/cancel", headers=employer_headers
    )
    assert cancelled.status_code == 200

    company_profile = await client.get(
        "/api/v1/companies/me/profile", headers=employer_headers
    )
    assert company_profile.json()["late_cancellations"] == 0
