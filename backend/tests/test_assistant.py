"""Tests del módulo assistant (asistente general de IA del panel del
comercio: crear turno/evento, consultar turnos, buscar candidatos, ver
postulantes — a partir de una única llamada de clasificación de intención).
"""

import json
from datetime import date

import pytest
from httpx import AsyncClient

import app.modules.assistant.application.services as assistant_services
from tests.conftest import auth_headers
from tests.test_gemini_shift_parser import _FakeAsyncClient, configured_gemini  # noqa: F401

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "tips": True,
        "dress_code": "Camisa negra",
        "urgent": True,
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


def _assistant_json(**overrides) -> str:
    data = {
        "intent": "desconocido",
        "position": None,
        "start_at": None,
        "end_at": None,
        "pay_amount": None,
        "urgent": False,
        "meal": False,
        "tips": True,
        "dress_code": None,
        "event_positions": None,
        "query_filter": None,
        "search_position": None,
        "applicants_position": None,
        "applicants_date_hint": None,
    }
    data.update(overrides)
    return json.dumps(data)


async def test_query_returns_503_when_not_configured(client: AsyncClient):
    employer = await _employer_with_company(client, "asst_emp1@staffya.com")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "necesito un mozo"}
    )
    assert response.status_code == 503


async def test_worker_cannot_use_assistant(client: AsyncClient, configured_gemini):
    """Es una herramienta del panel del comercio — un trabajador no la ve ni la usa."""
    worker = await auth_headers(client, "worker", "asst_w1@staffya.com")
    response = await client.post(
        "/api/v1/assistant/query", headers=worker, json={"text": "necesito un mozo"}
    )
    assert response.status_code == 403


async def test_crear_turno_intent_returns_shift_draft(client: AsyncClient, configured_gemini):
    employer = await _employer_with_company(client, "asst_emp2@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="crear_turno",
        position="mozo",
        pay_amount=45000,
        start_at="2026-08-15T20:00:00-03:00",
        end_at="2026-08-16T02:00:00-03:00",
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "necesito un mozo el sábado a la noche, se paga 45000"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "crear_turno"
    assert body["position"] == "mozo"
    assert body["pay_amount"] == "45000"


async def test_crear_evento_intent_returns_multiple_roles(client: AsyncClient, configured_gemini):
    """Caso real reportado por Julieta: "1 bachero 1 barrender 2 mozos" — el
    asistente antes forzaba todo a un solo turno (`crear_turno`) y fallaba;
    ahora distingue el intent y arma los 3 roles del evento."""
    employer = await _employer_with_company(client, "asst_emp3@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="crear_evento",
        event_positions=[
            {"position": "ayudante_cocina", "quantity": 1},
            {"position": "bartender", "quantity": 1},
            {"position": "mozo", "quantity": 2},
        ],
        start_at="2026-08-15T20:00:00-03:00",
        end_at="2026-08-16T02:00:00-03:00",
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "necesito crear un evento para el sábado: 1 bachero, 1 bartender, 2 mozos"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "crear_evento"
    assert len(body["event_positions"]) == 3
    assert {r["position"] for r in body["event_positions"]} == {
        "ayudante_cocina",
        "bartender",
        "mozo",
    }


async def test_crear_evento_with_no_valid_roles_degrades_to_desconocido(
    client: AsyncClient, configured_gemini
):
    employer = await _employer_with_company(client, "asst_emp4@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(intent="crear_evento", event_positions=[])
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "un texto raro"}
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "desconocido"


async def test_consultar_turnos_urgentes(client: AsyncClient, configured_gemini):
    employer = await _employer_with_company(client, "asst_emp5@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload(urgent=True))
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="consultar_turnos", query_filter="urgentes"
    )
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "¿qué tengo urgente?"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "consultar_turnos"
    assert body["query_count"] == 1
    assert body["query_tab"] == "buscando"
    assert "1 turno urgente" in body["query_summary"]


async def test_consultar_turnos_hoy(client: AsyncClient, configured_gemini, monkeypatch):
    # `hoy_art()` fijo (mismo patrón que test_worker_age.py) — evita depender
    # del reloj real de cuando corra el test.
    monkeypatch.setattr(assistant_services, "hoy_art", lambda: date(2026, 6, 28))

    employer = await _employer_with_company(client, "asst_emp6@staffya.com")
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(start_at="2026-06-28T15:00:00", end_at="2026-06-28T20:00:00"),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    _FakeAsyncClient.next_gemini_text = _assistant_json(intent="consultar_turnos", query_filter="hoy")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "¿qué tengo hoy?"}
    )
    assert response.status_code == 200
    assert response.json()["query_count"] == 1


async def test_buscar_candidatos_intent_returns_position(client: AsyncClient, configured_gemini):
    employer = await _employer_with_company(client, "asst_emp7@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="buscar_candidatos", search_position="mozo"
    )
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "buscame mozos disponibles"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "buscar_candidatos"
    assert body["search_position"] == "mozo"


async def test_ver_postulantes_finds_matching_shift(client: AsyncClient, configured_gemini):
    employer = await _employer_with_company(client, "asst_emp8@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=employer, json=_shift_payload(position="bartender")
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)

    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="ver_postulantes", applicants_position="bartender"
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "¿quién se postuló al turno de bartender?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "ver_postulantes"
    assert body["matched_shift_id"] == shift_id


async def test_ver_postulantes_without_match_falls_back_gracefully(
    client: AsyncClient, configured_gemini
):
    employer = await _employer_with_company(client, "asst_emp9@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="ver_postulantes", applicants_position="cocinero"
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "¿quién se postuló al turno de cocinero?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "desconocido"
    assert body["matched_shift_id"] is None


async def test_desconocido_intent_returns_friendly_message(client: AsyncClient, configured_gemini):
    employer = await _employer_with_company(client, "asst_emp10@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(intent="desconocido")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "esto no significa nada"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "desconocido"
    assert body["message"]
