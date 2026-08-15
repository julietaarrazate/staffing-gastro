"""Tests del módulo assistant (asistente general de IA del panel del
comercio: crear turno/evento, consultar turnos, buscar candidatos, ver
postulantes — a partir de una única llamada de clasificación de intención).
"""

import json
from datetime import date, datetime, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

import app.modules.assistant.application.services as assistant_services
from app.modules.assistant.infrastructure.models import AssistantQueryLogModel
from app.modules.verification.domain.entities import Claim
from app.modules.verification.domain.value_objects import ClaimStatus, ClaimType
from app.modules.verification.infrastructure.repositories import SqlAlchemyClaimRepository
from tests.conftest import auth_headers, login, register_user
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


async def _published_shift(client: AsyncClient, employer_headers: dict) -> str:
    created = await client.post("/api/v1/shifts", headers=employer_headers, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer_headers)
    return shift_id


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
        "verification_name": None,
    }
    data.update(overrides)
    return json.dumps(data)


async def test_query_returns_503_when_not_configured(client: AsyncClient):
    employer = await _employer_with_company(client, "asst_emp1@staffya.com")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "necesito un mozo"}
    )
    assert response.status_code == 503


async def test_query_rejects_text_over_500_chars(client: AsyncClient, configured_gemini):
    """F4 (auditoría 2026-08-15): mismo tope que `ParseShiftTextRequest`
    (shift/api/schemas.py) — sin esto, el rate limit acota la cantidad de
    llamadas a Gemini pero no el tamaño (y costo) de cada una."""
    employer = await _employer_with_company(client, "asst_emp_toolong@staffya.com")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "a" * 501}
    )
    assert response.status_code == 422


async def test_worker_query_rejects_text_over_500_chars(client: AsyncClient, configured_gemini):
    worker = await auth_headers(client, "worker", "asst_w_toolong@staffya.com")
    response = await client.post(
        "/api/v1/assistant/worker-query", headers=worker, json={"text": "a" * 501}
    )
    assert response.status_code == 422


async def test_query_caps_output_tokens(client: AsyncClient, configured_gemini):
    employer = await _employer_with_company(client, "asst_emp_tokens@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(intent="desconocido")
    await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "hola"}
    )
    assert _FakeAsyncClient.last_payload["generationConfig"]["maxOutputTokens"] > 0


async def test_worker_query_caps_output_tokens(client: AsyncClient, configured_gemini):
    worker = await auth_headers(client, "worker", "asst_w_tokens@staffya.com")
    _FakeAsyncClient.next_gemini_text = _worker_query_json(intent="desconocido")
    await client.post(
        "/api/v1/assistant/worker-query", headers=worker, json={"text": "hola"}
    )
    assert _FakeAsyncClient.last_payload["generationConfig"]["maxOutputTokens"] > 0


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


async def test_assistant_gets_no_company_context_with_little_history(
    client: AsyncClient, configured_gemini
):
    """P2 (Julieta: "la IA tiene que aprender cosas de cada persona, está
    muy genérica"): con 0 o 1 turno previo no hay señal real de "lo
    habitual" — no se manda ningún contexto de más (`_MIN_SHIFTS_FOR_CONTEXT`,
    `assistant/application/services.py`)."""
    employer = await _employer_with_company(client, "asst_emp_ctx1@staffya.com")
    await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())

    _FakeAsyncClient.next_gemini_text = _assistant_json(intent="desconocido")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "necesito personal"}
    )
    assert response.status_code == 200

    system_parts = _FakeAsyncClient.last_payload["systemInstruction"]["parts"]
    assert len(system_parts) == 1


async def test_assistant_gets_company_context_with_enough_history(
    client: AsyncClient, configured_gemini
):
    """Con 2+ turnos previos, se le suma a Gemini una segunda parte de
    `systemInstruction` resumiendo lo habitual de este comercio (puesto más
    pedido, horario típico, pago típico) — para que complete lo que el
    texto no dice en vez de dejarlo siempre en null."""
    employer = await _employer_with_company(client, "asst_emp_ctx2@staffya.com")
    await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(start_at="2026-06-29T20:00:00", end_at="2026-06-30T03:00:00"),
    )

    _FakeAsyncClient.next_gemini_text = _assistant_json(intent="desconocido")
    response = await client.post(
        "/api/v1/assistant/query", headers=employer, json={"text": "necesito personal"}
    )
    assert response.status_code == 200

    system_parts = _FakeAsyncClient.last_payload["systemInstruction"]["parts"]
    assert len(system_parts) == 2
    context_text = system_parts[1]["text"]
    assert "mozo" in context_text
    # `start_at` naive se asume UTC (mismo criterio que el resto del
    # dominio, ver `_naive`/`core/dt.py`): 20:00 se traduce a las 17:00 ART.
    assert "17:00hs" in context_text
    assert "70.000" in context_text


async def test_consultar_verificacion_reports_verified_applicant(
    client: AsyncClient, configured_gemini, session_factory: async_sessionmaker
):
    """El asistente responde si un postulante puntual (encontrado por nombre
    entre los postulantes de ESTE comercio) tiene la identidad verificada —
    reusa `VerificationService.verified_user_ids`, el mismo mecanismo ya
    probado en ADR-0010, sin dominio nuevo."""
    employer = await _employer_with_company(client, "asst_emp_verif1@staffya.com")
    shift_id = await _published_shift(client, employer)

    await register_user(
        client, email="asst_w_verified@staffya.com", full_name="Camila Duarte", role="worker"
    )
    worker_tokens = await login(client, "asst_w_verified@staffya.com")
    worker_headers = {"Authorization": f"Bearer {worker_tokens['access_token']}"}
    worker_user_id = worker_tokens["user"]["id"]
    await client.post(
        "/api/v1/workers/me/profile", headers=worker_headers, json={"skills": ["mozo"]}
    )
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker_headers)

    async with session_factory() as session:
        repo = SqlAlchemyClaimRepository(session)
        await repo.add(
            Claim(
                user_id=UUID(worker_user_id),
                claim_type=ClaimType.DOCUMENTO_VERIFICADO,
                status=ClaimStatus.VERIFICADA,
                decided_at=datetime.now(timezone.utc),
            )
        )

    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="consultar_verificacion", verification_name="Camila"
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "¿Camila está verificada?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "consultar_verificacion"
    assert body["verification_full_name"] == "Camila Duarte"
    assert body["verification_verified"] is True


async def test_consultar_verificacion_reports_unverified_applicant(
    client: AsyncClient, configured_gemini
):
    employer = await _employer_with_company(client, "asst_emp_verif2@staffya.com")
    shift_id = await _published_shift(client, employer)

    worker_headers = await auth_headers(
        client, "worker", "asst_w_unverified@staffya.com", full_name="Bruno Sosa"
    )
    await client.post(
        "/api/v1/workers/me/profile", headers=worker_headers, json={"skills": ["mozo"]}
    )
    await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=worker_headers)

    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="consultar_verificacion", verification_name="Bruno"
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "¿Bruno está verificado?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "consultar_verificacion"
    assert body["verification_full_name"] == "Bruno Sosa"
    assert body["verification_verified"] is False


async def test_consultar_verificacion_without_match_falls_back_gracefully(
    client: AsyncClient, configured_gemini
):
    employer = await _employer_with_company(client, "asst_emp_verif3@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="consultar_verificacion", verification_name="Nadie Existente"
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "¿Nadie Existente está verificado?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "desconocido"
    assert body["verification_full_name"] is None


async def test_consultar_verificacion_without_name_degrades_to_desconocido(
    client: AsyncClient, configured_gemini
):
    """Gemini devolvió el intent sin `verification_name` (o vacío) — degrada
    a `desconocido` antes de llegar a buscar nada, mismo criterio que
    `crear_evento` sin roles válidos."""
    employer = await _employer_with_company(client, "asst_emp_verif4@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="consultar_verificacion", verification_name=None
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "¿está verificado?"},
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "desconocido"


async def test_query_logs_the_resolved_intent(
    client: AsyncClient, configured_gemini, session_factory: async_sessionmaker
):
    """Señal de uso (P2, Julieta: "que vaya aprendiendo") — cada consulta
    resuelta queda registrada con el intent FINAL, base para un aprendizaje
    real futuro cuando haya volumen. Todavía no hay pipeline de
    entrenamiento; esto sólo junta la materia prima."""
    employer = await _employer_with_company(client, "asst_emp_log1@staffya.com")
    _FakeAsyncClient.next_gemini_text = _assistant_json(
        intent="buscar_candidatos", search_position="mozo"
    )
    response = await client.post(
        "/api/v1/assistant/query",
        headers=employer,
        json={"text": "buscame mozos disponibles"},
    )
    assert response.status_code == 200

    # Sin método de lectura en el puerto todavía (nadie lo necesita hoy, ver
    # docstring de `AssistantQueryLogEntry`) — se lee directo del modelo ORM,
    # sólo para esta verificación.
    async with session_factory() as session:
        rows = (await session.execute(select(AssistantQueryLogModel))).scalars().all()
    assert len(rows) == 1
    assert rows[0].text == "buscame mozos disponibles"
    assert rows[0].intent == "buscar_candidatos"


# --- Asistente del trabajador (búsqueda de turnos en texto libre) ----------


def _worker_query_json(**overrides) -> str:
    data = {
        "intent": "desconocido",
        "positions": [],
        "zone_name": None,
        "radius_km": None,
        "date_filter": "todos",
    }
    data.update(overrides)
    return json.dumps(data)


async def test_worker_query_returns_503_when_not_configured(client: AsyncClient):
    worker = await auth_headers(client, "worker", "wq_w1@staffya.com")
    response = await client.post(
        "/api/v1/assistant/worker-query", headers=worker, json={"text": "turno de mozo"}
    )
    assert response.status_code == 503


async def test_employer_cannot_use_worker_query(client: AsyncClient, configured_gemini):
    """Es una herramienta del trabajador — un comercio no la ve ni la usa."""
    employer = await _employer_with_company(client, "wq_emp1@staffya.com")
    response = await client.post(
        "/api/v1/assistant/worker-query", headers=employer, json={"text": "turno de mozo"}
    )
    assert response.status_code == 403


async def test_buscar_turnos_intent_returns_structured_filters(
    client: AsyncClient, configured_gemini
):
    """Caso real reportado por Julieta: "búscame un turno en palermo a menos
    de 2 kilómetros para hoy tanto para mozo barista y cajero"."""
    worker = await auth_headers(client, "worker", "wq_w2@staffya.com")
    _FakeAsyncClient.next_gemini_text = _worker_query_json(
        intent="buscar_turnos",
        positions=["mozo", "barista", "cajero"],
        zone_name="Palermo",
        radius_km=2,
        date_filter="hoy",
    )
    response = await client.post(
        "/api/v1/assistant/worker-query",
        headers=worker,
        json={
            "text": "búscame un turno en palermo a menos de 2 kilómetros para hoy "
            "tanto para mozo barista y cajero"
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "buscar_turnos"
    assert set(body["positions"]) == {"mozo", "barista", "cajero"}
    assert body["zone_name"] == "Palermo"
    assert body["radius_km"] == 2
    assert body["date_filter"] == "hoy"


async def test_worker_query_without_position_or_zone_degrades_to_desconocido(
    client: AsyncClient, configured_gemini
):
    """Sin puesto ni zona no hay nada que buscar distinto de lo que el feed
    ya muestra sin pasar por el asistente."""
    worker = await auth_headers(client, "worker", "wq_w3@staffya.com")
    _FakeAsyncClient.next_gemini_text = _worker_query_json(intent="buscar_turnos")
    response = await client.post(
        "/api/v1/assistant/worker-query",
        headers=worker,
        json={"text": "hola"},
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "desconocido"


async def test_worker_query_desconocido_intent_returns_friendly_message(
    client: AsyncClient, configured_gemini
):
    worker = await auth_headers(client, "worker", "wq_w4@staffya.com")
    _FakeAsyncClient.next_gemini_text = _worker_query_json(intent="desconocido")
    response = await client.post(
        "/api/v1/assistant/worker-query",
        headers=worker,
        json={"text": "qué día es hoy"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "desconocido"
    assert body["message"]
