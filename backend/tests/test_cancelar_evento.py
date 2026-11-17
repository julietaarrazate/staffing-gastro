"""Cancelar un evento entero (U084, decisión de Julieta del 2026-11-17).

Un botón, con las mismas reglas que cancelar cada puesto: a cada asignado y a
cada postulación pendiente le llega su aviso, y cada puesto con alguien ya
confirmado suma su cancelación tardía. Lo que ya terminó o estaba cancelado
no se toca. Evento ajeno o inexistente: 404.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

_CANCEL_TYPES = {"shift_cancelled", "shift_cancelled_late", "applied_shift_cancelled"}


async def _employer(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Salón Palermo")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Salón Palermo", "city": "Palermo"},
    )
    return headers


async def _worker(client: AsyncClient, email: str) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email, "Ana Mozo")
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return headers, profile.json()["id"]


async def _evento(client: AsyncClient, employer: dict, mozos: int = 3) -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=2)
    response = await client.post(
        "/api/v1/shifts/events",
        headers=employer,
        json={
            "name": "Boda Martínez",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=6)).isoformat(),
            "city": "Palermo",
            "latitude": -34.5875,
            "longitude": -58.43,
            "roles": [{"position": "mozo", "count": mozos, "pay_amount": "50000.00"}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _confirmar(client: AsyncClient, employer: dict, shift_id: str, worker: dict, profile_id: str):
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker)
    assert applied.status_code == 201, applied.text
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=employer, json={"worker_profile_id": profile_id}
    )
    assert assigned.status_code == 200, assigned.text
    confirmed = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    assert confirmed.json()["status"] == "confirmado", confirmed.text


async def _avisos(client: AsyncClient, headers: dict) -> list[dict]:
    listed = await client.get("/api/v1/notifications", headers=headers)
    return [n for n in listed.json() if n["type"] in _CANCEL_TYPES]


async def _tardias(client: AsyncClient, employer: dict) -> int:
    profile = await client.get("/api/v1/companies/me/profile", headers=employer)
    return profile.json()["late_cancellations"]


async def test_cancela_todos_los_puestos_con_avisos_y_tardia(client: AsyncClient):
    employer = await _employer(client, "ev_emp@staffya.com")
    confirmada, confirmada_id = await _worker(client, "ev_conf@staffya.com")
    postulada, _ = await _worker(client, "ev_post@staffya.com")
    evento = await _evento(client, employer)
    puestos = [s["id"] for s in evento["shifts"]]

    await _confirmar(client, employer, puestos[0], confirmada, confirmada_id)
    applied = await client.post(f"/api/v1/applications/shifts/{puestos[1]}", headers=postulada)
    assert applied.status_code == 201

    response = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=employer
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["event_id"] == evento["event_id"]
    assert sorted(s["id"] for s in body["cancelled"]) == sorted(puestos)
    assert all(s["status"] == "cancelado" for s in body["cancelled"])
    # Mismos avisos que cancelar cada puesto: uno por persona y por puesto.
    assert [n["type"] for n in await _avisos(client, confirmada)] == ["shift_cancelled_late"]
    assert [n["type"] for n in await _avisos(client, postulada)] == ["applied_shift_cancelled"]
    # Un solo puesto tenía a alguien confirmado: una sola tardía.
    assert await _tardias(client, employer) == 1


async def test_cada_puesto_confirmado_suma_su_tardia(client: AsyncClient):
    employer = await _employer(client, "ev_emp2@staffya.com")
    w1, p1 = await _worker(client, "ev_w1@staffya.com")
    w2, p2 = await _worker(client, "ev_w2@staffya.com")
    evento = await _evento(client, employer, mozos=2)
    a, b = (s["id"] for s in evento["shifts"])
    await _confirmar(client, employer, a, w1, p1)
    # Mismo horario que el puesto de w1: w2 confirma el otro (son personas distintas).
    await _confirmar(client, employer, b, w2, p2)

    response = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=employer
    )

    assert response.status_code == 200, response.text
    assert await _tardias(client, employer) == 2


async def test_saltea_lo_ya_cancelado_y_sin_nada_para_cancelar_es_400(client: AsyncClient):
    employer = await _employer(client, "ev_emp3@staffya.com")
    evento = await _evento(client, employer, mozos=2)
    primero = evento["shifts"][0]["id"]
    await client.post(f"/api/v1/shifts/{primero}/cancel", headers=employer)

    response = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=employer
    )
    assert response.status_code == 200
    assert [s["id"] for s in response.json()["cancelled"]] == [evento["shifts"][1]["id"]]

    otra_vez = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=employer
    )
    assert otra_vez.status_code == 400
    assert otra_vez.json()["detail"] == "Este evento ya no tiene puestos para cancelar."


async def test_evento_ajeno_o_inexistente_es_404(client: AsyncClient):
    duenio = await _employer(client, "ev_duenio@staffya.com")
    otro = await _employer(client, "ev_otro@staffya.com")
    evento = await _evento(client, duenio, mozos=1)

    ajeno = await client.post(f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=otro)
    inexistente = await client.post(f"/api/v1/shifts/events/{uuid4()}/cancel", headers=duenio)

    assert ajeno.status_code == 404
    assert inexistente.status_code == 404
    # El del dueño sigue en pie.
    turno = await client.get(f"/api/v1/shifts/{evento['shifts'][0]['id']}", headers=duenio)
    assert turno.json()["status"] != "cancelado"


async def test_un_trabajador_no_puede_cancelar_un_evento(client: AsyncClient):
    employer = await _employer(client, "ev_emp4@staffya.com")
    worker, _ = await _worker(client, "ev_w4@staffya.com")
    evento = await _evento(client, employer, mozos=1)

    response = await client.post(
        f"/api/v1/shifts/events/{evento['event_id']}/cancel", headers=worker
    )

    assert response.status_code in (403, 404)
