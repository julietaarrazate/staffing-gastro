"""Tests de la interpretación de texto libre para turnos vía Gemini (P2,
auditoría de producto 2026-08-10): unitarios del cliente HTTP (mockeado,
nunca pega a la red real) + integración del endpoint HTTP.
"""

import json

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.gemini import GeminiNotConfiguredError, GeminiRequestError, parse_shift_text
from tests.conftest import auth_headers


class _FakeResponse:
    def __init__(self, body: dict):
        self._body = body

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._body


class _FakeAsyncClient:
    """Reemplaza `httpx.AsyncClient` para no pegar a la red real en tests."""

    last_payload: dict | None = None
    next_gemini_text: str = ""

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, params=None, json=None):
        _FakeAsyncClient.last_payload = json
        text = _FakeAsyncClient.next_gemini_text
        return _FakeResponse(
            {"candidates": [{"content": {"parts": [{"text": text}]}}]}
        )


def _gemini_json(**overrides) -> str:
    data = {
        "position": "mozo",
        "start_at": "2026-08-15T20:00:00-03:00",
        "end_at": "2026-08-16T02:00:00-03:00",
        "pay_amount": 45000,
        "urgent": False,
        "meal": False,
        "tips": True,
        "dress_code": None,
    }
    data.update(overrides)
    return json.dumps(data)


@pytest.fixture
def configured_gemini(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-gemini-key")
    monkeypatch.setattr("app.core.gemini.httpx.AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.next_gemini_text = _gemini_json()
    yield
    monkeypatch.setattr(settings, "gemini_api_key", "")


@pytest.mark.asyncio
async def test_parse_shift_text_raises_when_not_configured():
    assert settings.gemini_api_key == ""
    with pytest.raises(GeminiNotConfiguredError):
        await parse_shift_text("necesito 2 mozos el sábado a la noche")


@pytest.mark.asyncio
async def test_parse_shift_text_returns_structured_draft(configured_gemini):
    draft = await parse_shift_text("necesito un mozo el sábado a la noche, se paga 45000")
    assert draft.position == "mozo"
    assert draft.pay_amount == 45000
    assert draft.tips is True
    assert draft.urgent is False


@pytest.mark.asyncio
async def test_parse_shift_text_discards_unknown_position(configured_gemini, monkeypatch):
    _FakeAsyncClient.next_gemini_text = _gemini_json(position="desconocido")
    draft = await parse_shift_text("necesito gente para el sábado")
    assert draft.position is None


@pytest.mark.asyncio
async def test_parse_shift_text_raises_on_malformed_response(configured_gemini):
    _FakeAsyncClient.next_gemini_text = "esto no es JSON"
    with pytest.raises(GeminiRequestError):
        await parse_shift_text("cualquier texto")


@pytest.mark.asyncio
async def test_parse_text_endpoint_returns_503_when_not_configured(client: AsyncClient):
    employer = await auth_headers(client, "employer", "emp_gemini1@staffya.com")
    response = await client.post(
        "/api/v1/shifts/parse-text", json={"text": "necesito un mozo"}, headers=employer
    )
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_parse_text_endpoint_returns_draft_when_configured(
    client: AsyncClient, configured_gemini
):
    employer = await auth_headers(client, "employer", "emp_gemini2@staffya.com")
    response = await client.post(
        "/api/v1/shifts/parse-text",
        json={"text": "necesito un mozo el sábado a la noche, se paga 45000"},
        headers=employer,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["position"] == "mozo"
    assert body["pay_amount"] == "45000"
    assert body["tips"] is True


@pytest.mark.asyncio
async def test_worker_cannot_parse_shift_text(client: AsyncClient, configured_gemini):
    """Sólo el comercio publica turnos — el trabajador no tiene este endpoint."""
    worker = await auth_headers(client, "worker", "w_gemini1@staffya.com")
    response = await client.post(
        "/api/v1/shifts/parse-text", json={"text": "necesito un mozo"}, headers=worker
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_parse_text_endpoint_falls_back_gracefully_on_malformed_datetime(
    client: AsyncClient, configured_gemini
):
    """Un horario mal formado no rompe el endpoint entero: ese campo queda
    en null y el resto de los datos parseados se sigue devolviendo."""
    _FakeAsyncClient.next_gemini_text = _gemini_json(start_at="no es una fecha")
    employer = await auth_headers(client, "employer", "emp_gemini3@staffya.com")
    response = await client.post(
        "/api/v1/shifts/parse-text", json={"text": "necesito un mozo"}, headers=employer
    )
    assert response.status_code == 200
    body = response.json()
    assert body["start_at"] is None
    assert body["position"] == "mozo"
