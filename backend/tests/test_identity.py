"""Tests de integración del módulo de identidad (registro, login, refresh, /me)."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from tests.conftest import (
    DEFAULT_PASSWORD,
    login,
    new_client,
    refresh_with_cookie,
    register_user,
)

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
    assert "refresh_token" not in tokens
    # TECH_DEBT.md S1: el refresh token viaja como cookie httpOnly, nunca en
    # el body — así un XSS que lea la respuesta no puede exfiltrarlo.
    assert login_response.cookies.get("staffya_refresh")
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
    await login(client, "mozo@staffya.com")
    refresh_token = client.cookies.get("staffya_refresh")
    assert refresh_token

    # La cookie va sola (jar de httpx, como haría un navegador): no hace
    # falta reenviar el token a mano.
    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]
    assert "refresh_token" not in refreshed.json()
    new_refresh_token = client.cookies.get("staffya_refresh")
    assert new_refresh_token
    assert new_refresh_token != refresh_token

    # El nuevo refresh token sí sirve (se verifica antes de "gastar" la
    # detección de reuso, que revocaría también esta sesión nueva).
    again = await client.post("/api/v1/auth/refresh")
    assert again.status_code == 200

    # El refresh token original (ya rotado en el primer /refresh) no debe
    # servir para renovar de nuevo — se reenvía a mano en un cliente nuevo
    # (el jar de `client` ya avanzó al token rotado).
    reused = await refresh_with_cookie(refresh_token)
    assert reused.status_code == 401


async def test_refresh_reuse_revokes_all_sessions(client: AsyncClient):
    """Reusar un refresh token ya rotado se trata como robo: revoca todas las sesiones."""
    await register_user(client)
    await login(client, "mozo@staffya.com")
    token_a = client.cookies.get("staffya_refresh")

    # Segunda sesión (p. ej. otro dispositivo): cliente independiente, con su
    # propio jar de cookies.
    async with new_client() as client_b:
        await client_b.post(
            "/api/v1/auth/login",
            json={"email": "mozo@staffya.com", "password": DEFAULT_PASSWORD},
        )
        token_b = client_b.cookies.get("staffya_refresh")
        assert token_b

        # Se rota la sesión A con normalidad.
        refreshed_a = await client.post("/api/v1/auth/refresh")
        assert refreshed_a.status_code == 200
        rotated_a = client.cookies.get("staffya_refresh")

        # Alguien reusa el refresh token viejo de la sesión A (posible token robado).
        reuse = await refresh_with_cookie(token_a)
        assert reuse.status_code == 401

        # El reuso revoca TODAS las sesiones del usuario: la sesión A rotada...
        rotated_a_refresh = await refresh_with_cookie(rotated_a)
        assert rotated_a_refresh.status_code == 401

        # ...y también la sesión B, que nunca se usó de forma indebida.
        session_b_refresh = await client_b.post("/api/v1/auth/refresh")
        assert session_b_refresh.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    assert client.cookies.get("staffya_refresh")

    logout_response = await client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204
    # El backend limpia la cookie en la respuesta (Set-Cookie con Max-Age=0);
    # httpx respeta la baja igual que lo haría un navegador.
    assert client.cookies.get("staffya_refresh") is None

    # Sin cookie, /auth/refresh no tiene qué renovar.
    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 401


async def test_logout_invalid_token_returns_401(client: AsyncClient):
    async with new_client(cookies={"staffya_refresh": "no-es-un-jwt"}) as ac:
        logout_response = await ac.post("/api/v1/auth/logout")
    assert logout_response.status_code == 401


async def test_logout_without_cookie_is_a_noop(client: AsyncClient):
    """Cerrar sesión sin haber iniciado una (sin cookie) no es un error: no
    hay nada que revocar, a diferencia de una cookie presente pero inválida
    (`test_logout_invalid_token_returns_401`, sí 401)."""
    logout_response = await client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204


async def test_login_still_works_end_to_end_after_logout(client: AsyncClient):
    """Un logout no afecta la posibilidad de volver a loguearse y operar normalmente."""
    await register_user(client)
    await login(client, "mozo@staffya.com")
    await client.post("/api/v1/auth/logout")

    new_tokens = await login(client, "mozo@staffya.com")
    assert new_tokens["access_token"]
    assert client.cookies.get("staffya_refresh")

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "mozo@staffya.com"

    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200


async def test_refresh_token_cannot_access_me(client: AsyncClient):
    """Un refresh token no debe servir como access token."""
    await register_user(client)
    await login(client, "mozo@staffya.com")
    refresh_token = client.cookies.get("staffya_refresh")
    assert refresh_token

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
        async with new_client(cookies={"staffya_refresh": "no-es-un-token-valido"}) as ac:
            statuses = [
                (await ac.post("/api/v1/auth/refresh")).status_code for _ in range(22)
            ]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    # El límite es 20/min: las primeras responden 401 (token inválido) y
    # luego aparece un 429 — el rate limiter corre antes de validar el token.
    assert 429 in statuses
    assert statuses.index(429) >= 20
