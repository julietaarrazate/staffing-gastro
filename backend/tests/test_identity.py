"""Tests de integración del módulo de identidad (registro, login, refresh, /me)."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from tests.conftest import login, register_user

pytestmark = pytest.mark.asyncio


async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_health_responde_a_head(client: AsyncClient):
    """Los monitores de uptime (UptimeRobot y la mayoría) chequean con HEAD.
    Sin esto el endpoint devolvía 405 y el monitor reportaba el servicio como
    caído estando sano — visto en los logs de producción de Render."""
    response = await client.head("/health")
    assert response.status_code == 200


async def test_register_success(client: AsyncClient):
    response = await register_user(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "mozo@staffya.com"
    assert body["role"] == "worker"
    assert body["is_verified"] is False
    assert "id" in body


async def test_register_duplicate_email(client: AsyncClient):
    await register_user(client)
    response = await register_user(client)
    assert response.status_code == 409


async def test_register_short_password(client: AsyncClient):
    response = await register_user(client, password="corta")
    assert response.status_code == 422


async def test_login_success_and_me(client: AsyncClient):
    await register_user(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "mozo@staffya.com", "password": "supersecreta123"},
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    # El usuario viene embebido en la respuesta del login: el cliente entra sin
    # encadenar un GET /auth/me (un round-trip menos al backend remoto).
    assert tokens["user"] is not None
    assert tokens["user"]["email"] == "mozo@staffya.com"
    assert tokens["user"]["role"] == "worker"

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "mozo@staffya.com"


async def test_update_my_full_name(client: AsyncClient):
    """El nombre queda fijo desde el registro (email o Google) sin forma de
    corregirlo (Julieta, 2026-07-30): ahora se puede editar desde el propio
    perfil."""
    await register_user(client)
    tokens = await login(client, "mozo@staffya.com")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    updated = await client.patch(
        "/api/v1/auth/me", headers=headers, json={"full_name": "Juan Carlos Mozo"}
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Juan Carlos Mozo"

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["full_name"] == "Juan Carlos Mozo"


async def test_update_my_full_name_requires_auth(client: AsyncClient):
    response = await client.patch("/api/v1/auth/me", json={"full_name": "Nadie"})
    assert response.status_code in (401, 403)


async def test_update_my_full_name_rejects_empty(client: AsyncClient):
    await register_user(client)
    tokens = await login(client, "mozo@staffya.com")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.patch(
        "/api/v1/auth/me", headers=headers, json={"full_name": "  "}
    )
    assert response.status_code == 422


async def test_login_wrong_password(client: AsyncClient):
    await register_user(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "mozo@staffya.com", "password": "incorrecta"},
    )
    assert login_response.status_code == 401


async def test_refresh_rotates_tokens(client: AsyncClient):
    """Cada /auth/refresh rota la sesión: el refresh usado deja de servir (ADR-0002)."""
    await register_user(client)
    tokens = await login(client, "mozo@staffya.com")
    refresh_token = tokens["refresh_token"]

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert new_tokens["access_token"]
    assert new_tokens["refresh_token"]
    assert new_tokens["refresh_token"] != refresh_token

    # El nuevo refresh token sí sirve (se verifica antes de "gastar" la
    # detección de reuso, que revocaría también esta sesión nueva).
    again = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert again.status_code == 200

    # El refresh token original (ya rotado en el primer /refresh) no debe
    # servir para renovar de nuevo.
    reused = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert reused.status_code == 401


async def test_refresh_reuse_revokes_all_sessions(client: AsyncClient):
    """Reusar un refresh token ya rotado se trata como robo: revoca todas las sesiones."""
    await register_user(client)
    tokens_a = await login(client, "mozo@staffya.com")

    # Segunda sesión (p. ej. otro dispositivo).
    tokens_b = await login(client, "mozo@staffya.com")

    # Se rota la sesión A con normalidad.
    refreshed_a = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens_a["refresh_token"]}
    )
    assert refreshed_a.status_code == 200
    rotated_a = refreshed_a.json()["refresh_token"]

    # Alguien reusa el refresh token viejo de la sesión A (posible token robado).
    reuse = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens_a["refresh_token"]}
    )
    assert reuse.status_code == 401

    # El reuso revoca TODAS las sesiones del usuario: la sesión A rotada...
    rotated_a_refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": rotated_a}
    )
    assert rotated_a_refresh.status_code == 401

    # ...y también la sesión B, que nunca se usó de forma indebida.
    session_b_refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens_b["refresh_token"]}
    )
    assert session_b_refresh.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient):
    await register_user(client)
    tokens = await login(client, "mozo@staffya.com")

    logout_response = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    assert logout_response.status_code == 204

    # El refresh token ya deslogueado no debe servir para renovar.
    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 401


async def test_logout_invalid_token_returns_401(client: AsyncClient):
    logout_response = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": "no-es-un-jwt"}
    )
    assert logout_response.status_code == 401


async def test_login_still_works_end_to_end_after_logout(client: AsyncClient):
    """Un logout no afecta la posibilidad de volver a loguearse y operar normalmente."""
    await register_user(client)
    tokens = await login(client, "mozo@staffya.com")
    await client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})

    new_tokens = await login(client, "mozo@staffya.com")
    assert new_tokens["access_token"]
    assert new_tokens["refresh_token"]

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "mozo@staffya.com"

    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200


async def test_refresh_token_cannot_access_me(client: AsyncClient):
    """Un refresh token no debe servir como access token."""
    await register_user(client)
    tokens = await login(client, "mozo@staffya.com")
    refresh_token = tokens["refresh_token"]

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert me.status_code == 401


async def test_me_requires_auth(client: AsyncClient):
    me = await client.get("/api/v1/auth/me")
    assert me.status_code in (401, 403)


async def test_register_cannot_self_assign_admin_role(client: AsyncClient):
    """El registro público no debe permitir elegir el rol admin."""
    response = await register_user(client, role="admin")
    assert response.status_code == 422


async def test_login_rate_limited(client: AsyncClient):
    """Tras superar el límite por IP, el login responde 429."""
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        await register_user(client)
        creds = {"email": "mozo@staffya.com", "password": "incorrecta"}
        statuses = [
            (await client.post("/api/v1/auth/login", json=creds)).status_code
            for _ in range(12)
        ]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    # El límite es 10/min: las primeras responden 401 y luego aparece un 429.
    assert 429 in statuses
    assert statuses.index(429) >= 10


async def test_refresh_rate_limited(client: AsyncClient):
    """Tras superar el límite por IP, /auth/refresh responde 429 (antes no
    tenía ningún límite, a diferencia de login/register)."""
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        statuses = [
            (
                await client.post(
                    "/api/v1/auth/refresh", json={"refresh_token": "no-es-un-token-valido"}
                )
            ).status_code
            for _ in range(22)
        ]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    # El límite es 20/min: las primeras responden 401 (token inválido) y
    # luego aparece un 429 — el rate limiter corre antes de validar el token.
    assert 429 in statuses
    assert statuses.index(429) >= 20
