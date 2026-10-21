"""Topes diarios de la IA (revisión de seguridad 2026-10-20 y su revisión
del 2026-10-21): presupuesto global separado por función y tope por cuenta
que, para las cuentas invitadas compartidas, cuenta por IP."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.gemini import (
    GeminiUnavailableError,
    interpret_worker_shift_query,
    parse_shift_text,
    reset_gemini_daily_usage,
    suggest_ticket_reply,
)
from app.core.rate_limit import reset_all_rate_limiters
from app.modules.assistant.api import routes as assistant_routes
from app.modules.shift.api import routes as shift_routes
from tests.conftest import TEST_GUEST_PIN, auth_headers
from tests.test_gemini_shift_parser import _FakeAsyncClient, configured_gemini  # noqa: F401

pytestmark = pytest.mark.asyncio

VALOR_EDGE = "valor-de-test"


@pytest.fixture
def cuota_limpia():
    reset_gemini_daily_usage()
    yield
    reset_gemini_daily_usage()


@pytest.fixture
def limites_prendidos(monkeypatch):
    """Prende los rate limits (apagados en conftest) y el edge, para que la
    IP del cliente salga de `X-Oido-Client-IP` como en producción."""
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "edge_shared_secret", VALOR_EDGE)
    reset_all_rate_limiters()
    yield
    reset_all_rate_limiters()


def _desde(ip: str, headers: dict | None = None) -> dict:
    return {**(headers or {}), "X-Oido-Edge": VALOR_EDGE, "X-Oido-Client-IP": ip}


async def _guest_headers(client: AsyncClient, role: str, ip: str) -> dict:
    resp = await client.post(
        "/api/v1/auth/guest", json={"pin": TEST_GUEST_PIN, "role": role}, headers=_desde(ip)
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# --- Presupuesto global por función ---------------------------------------


async def test_global_daily_limit_stops_calls_to_gemini(
    configured_gemini, cuota_limpia, monkeypatch
):
    """Un tope diario de toda la app, para que muchas cuentas juntas no
    agoten la cuota de Google."""
    monkeypatch.setattr(settings, "gemini_daily_limit_parse_text", 2)
    await parse_shift_text("necesito un mozo hoy")
    await parse_shift_text("necesito una bachera mañana")
    with pytest.raises(GeminiUnavailableError):
        await parse_shift_text("necesito un cocinero")


async def test_agotar_el_asistente_del_trabajador_no_apaga_parse_text_ni_soporte(
    configured_gemini, cuota_limpia, monkeypatch
):
    """Revisión 2026-10-21: con un tope único, muchas cuentas de trabajador
    autoregistradas apagaban también "Describí el turno" de los comercios y la
    sugerencia de soporte. Cada función tiene su presupuesto."""
    monkeypatch.setattr(settings, "gemini_daily_limit_trabajador", 1)
    monkeypatch.setattr(settings, "gemini_daily_limit_parse_text", 1)
    monkeypatch.setattr(settings, "gemini_daily_limit_soporte", 1)
    _FakeAsyncClient.next_gemini_text = (
        '{"intent": "desconocido", "positions": [], "zone_name": null,'
        ' "radius_km": null, "date_filter": "todos"}'
    )
    await interpret_worker_shift_query("turno de mozo")
    with pytest.raises(GeminiUnavailableError):
        await interpret_worker_shift_query("turno de bachero")

    _FakeAsyncClient.next_gemini_text = (
        '{"position": "mozo", "quantity": 1, "start_at": null, "end_at": null,'
        ' "pay_amount": null, "urgent": false, "meal": false, "tips": true,'
        ' "dress_code": null}'
    )
    draft = await parse_shift_text("necesito un mozo hoy")
    assert draft.position == "mozo"

    _FakeAsyncClient.next_gemini_text = '{"summary": "x", "suggested_reply": "y"}'
    suggestion = await suggest_ticket_reply("No puedo entrar", "cuenta", "Usuario: hola")
    assert suggestion.suggested_reply == "y"


# --- Tope por cuenta y cuentas invitadas ----------------------------------


async def test_invitados_de_distintas_ip_no_comparten_el_tope_de_parse_text(
    client: AsyncClient, configured_gemini, cuota_limpia, limites_prendidos, monkeypatch
):
    """Revisión 2026-10-21: la cuenta invitada es una sola por rol; si el tope
    fuera por cuenta, un tester lo agotaba para todos los demás."""
    monkeypatch.setattr(shift_routes._parse_shift_text_daily_limit, "max_attempts", 2)
    tester_a = await _guest_headers(client, "employer", "203.0.113.10")
    tester_b = await _guest_headers(client, "employer", "203.0.113.11")
    body = {"text": "necesito un mozo hoy a la noche"}

    for _ in range(2):
        ok = await client.post(
            "/api/v1/shifts/parse-text", json=body, headers=_desde("203.0.113.10", tester_a)
        )
        assert ok.status_code == 200
    agotado = await client.post(
        "/api/v1/shifts/parse-text", json=body, headers=_desde("203.0.113.10", tester_a)
    )
    assert agotado.status_code == 429

    otro_tester = await client.post(
        "/api/v1/shifts/parse-text", json=body, headers=_desde("203.0.113.11", tester_b)
    )
    assert otro_tester.status_code == 200


async def test_invitados_de_distintas_ip_no_comparten_el_tope_de_worker_query(
    client: AsyncClient, configured_gemini, cuota_limpia, limites_prendidos, monkeypatch
):
    monkeypatch.setattr(assistant_routes._worker_query_daily_limit, "max_attempts", 1)
    _FakeAsyncClient.next_gemini_text = (
        '{"intent": "desconocido", "positions": [], "zone_name": null,'
        ' "radius_km": null, "date_filter": "todos"}'
    )
    tester_a = await _guest_headers(client, "worker", "203.0.113.20")
    tester_b = await _guest_headers(client, "worker", "203.0.113.21")
    body = {"text": "turno de mozo"}

    url = "/api/v1/assistant/worker-query"
    ok = await client.post(url, json=body, headers=_desde("203.0.113.20", tester_a))
    assert ok.status_code == 200
    agotado = await client.post(url, json=body, headers=_desde("203.0.113.20", tester_a))
    assert agotado.status_code == 429
    otro_tester = await client.post(url, json=body, headers=_desde("203.0.113.21", tester_b))
    assert otro_tester.status_code == 200


async def test_una_cuenta_normal_sigue_contando_por_cuenta_aunque_cambie_de_ip(
    client: AsyncClient, configured_gemini, cuota_limpia, limites_prendidos, monkeypatch
):
    """Cambiar de IP (o de red) no le da a una cuenta común un tope nuevo."""
    monkeypatch.setattr(shift_routes._parse_shift_text_daily_limit, "max_attempts", 1)
    monkeypatch.setattr(settings, "edge_shared_secret", "")
    employer = await auth_headers(client, "employer", "cuota_emp@staffya.com")
    monkeypatch.setattr(settings, "edge_shared_secret", VALOR_EDGE)
    body = {"text": "necesito un mozo hoy a la noche"}

    ok = await client.post(
        "/api/v1/shifts/parse-text", json=body, headers=_desde("203.0.113.30", employer)
    )
    assert ok.status_code == 200
    otra_ip = await client.post(
        "/api/v1/shifts/parse-text", json=body, headers=_desde("203.0.113.31", employer)
    )
    assert otra_ip.status_code == 429
