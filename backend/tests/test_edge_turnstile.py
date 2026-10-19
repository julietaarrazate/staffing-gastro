"""Backend detrás de Cloudflare (`app/core/edge.py`) y Turnstile
(`app/core/turnstile.py`). Etapa 3 de la mudanza, 2026-10-14."""

import pytest
from httpx import AsyncClient

from app.core import turnstile
from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from tests.conftest import register_user

VALOR_EDGE = "valor-de-test"
LOGIN = {"email": "mozo@staffya.com", "password": "supersecreta123"}


@pytest.fixture
def edge(monkeypatch):
    monkeypatch.setattr(settings, "edge_shared_secret", VALOR_EDGE)


@pytest.fixture
def con_turnstile(monkeypatch):
    monkeypatch.setattr(settings, "turnstile_secret_key", "clave-turnstile")
    turnstile.reset()
    validos: set[str] = {"token-bueno"}
    usados: set[str] = set()

    async def falso_siteverify(token: str, ip: str) -> bool:
        # Como Cloudflare: cada token sirve una sola vez.
        if token in validos and token not in usados:
            usados.add(token)
            return True
        return False

    monkeypatch.setattr(turnstile, "_siteverify", falso_siteverify)
    yield
    turnstile.reset()


# --- Sólo por Cloudflare -------------------------------------------------


async def test_sin_secreto_todo_sigue_como_antes(client: AsyncClient):
    assert (await client.get("/api/v1/shifts/feed")).status_code != 403


async def test_con_secreto_rechaza_lo_que_no_viene_por_cloudflare(client: AsyncClient, edge):
    res = await client.post("/api/v1/auth/login", json=LOGIN)
    assert res.status_code == 403
    res = await client.post(
        "/api/v1/auth/login", json=LOGIN, headers={"X-Oido-Edge": "otro-valor"}
    )
    assert res.status_code == 403


async def test_con_secreto_deja_pasar_lo_que_viene_por_cloudflare(client: AsyncClient, edge):
    headers = {"X-Oido-Edge": VALOR_EDGE}
    res = await client.post(
        "/api/v1/auth/register",
        json={**LOGIN, "full_name": "Mozo", "role": "worker", "accepted_terms": True},
        headers=headers,
    )
    assert res.status_code == 201


async def test_health_queda_abierto_para_render(client: AsyncClient, edge):
    assert (await client.get("/health")).status_code == 200


async def test_la_ip_real_sale_de_cloudflare_solo_con_el_secreto(client: AsyncClient, edge):
    """Con el secreto, el límite de intentos cuenta por persona (CF-Connecting-IP)
    y no por la IP del proxy. Sin el secreto, ese header no se cree."""
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        for _ in range(10):
            await client.post(
                "/api/v1/auth/login",
                json=LOGIN,
                headers={"X-Oido-Edge": VALOR_EDGE, "CF-Connecting-IP": "203.0.113.1"},
            )
        bloqueada = await client.post(
            "/api/v1/auth/login",
            json=LOGIN,
            headers={"X-Oido-Edge": VALOR_EDGE, "CF-Connecting-IP": "203.0.113.1"},
        )
        assert bloqueada.status_code == 429
        otra_persona = await client.post(
            "/api/v1/auth/login",
            json=LOGIN,
            headers={"X-Oido-Edge": VALOR_EDGE, "X-Oido-Client-IP": "203.0.113.2"},
        )
        assert otra_persona.status_code != 429
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()


# --- Turnstile -----------------------------------------------------------


async def test_turnstile_apagado_no_pide_token(client: AsyncClient):
    assert (await register_user(client)).status_code == 201


async def test_turnstile_rechaza_sin_token_o_con_token_falso(client: AsyncClient, con_turnstile):
    assert (await client.post("/api/v1/auth/login", json=LOGIN)).status_code == 400
    res = await client.post(
        "/api/v1/auth/login", json=LOGIN, headers={"X-Turnstile-Token": "inventado"}
    )
    assert res.status_code == 400
    assert "robot" in res.json()["detail"]


async def test_turnstile_registro_y_login_seguidos_con_el_mismo_token(
    client: AsyncClient, con_turnstile
):
    headers = {"X-Turnstile-Token": "token-bueno"}
    res = await client.post(
        "/api/v1/auth/register",
        json={**LOGIN, "full_name": "Mozo", "role": "worker", "accepted_terms": True},
        headers=headers,
    )
    assert res.status_code == 201
    assert (await client.post("/api/v1/auth/login", json=LOGIN, headers=headers)).status_code == 200
    # Una tercera vez ya no: el token se reusa una sola vez.
    assert (await client.post("/api/v1/auth/login", json=LOGIN, headers=headers)).status_code == 400
