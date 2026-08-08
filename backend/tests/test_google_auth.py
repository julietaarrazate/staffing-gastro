"""Tests de integración de Google Sign-In (`POST /auth/google`).

No llaman a Google real: se sobreescribe la dependencia `get_google_verifier`
con un `_FakeGoogleVerifier` (mismo patrón que `NullEmailSender` para tests
de notificación), así los tests son deterministas y no dependen de red.
"""

import pytest
from httpx import AsyncClient

from app.main import app
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.exceptions import (
    GoogleAuthNotConfiguredError,
    GoogleTokenInvalidError,
)
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


class _FakeGoogleVerifier(GoogleTokenVerifier):
    def __init__(
        self, identity: GoogleIdentity | None = None, error: Exception | None = None
    ) -> None:
        self._identity = identity
        self._error = error

    async def verify(self, id_token: str) -> GoogleIdentity:
        if self._error is not None:
            raise self._error
        assert self._identity is not None
        return self._identity


def _override_verifier(verifier: GoogleTokenVerifier) -> None:
    app.dependency_overrides[get_google_verifier] = lambda: verifier


@pytest.fixture(autouse=True)
def _clear_google_override():
    yield
    app.dependency_overrides.pop(get_google_verifier, None)


async def test_google_login_new_user_requires_role(client: AsyncClient):
    """Email nuevo, sin rol elegido todavía: pide rol, no crea la cuenta."""
    _override_verifier(
        _FakeGoogleVerifier(
            GoogleIdentity(email="nuevo@gmail.com", email_verified=True, full_name="Nuevo Usuario")
        )
    )
    response = await client.post("/api/v1/auth/google", json={"id_token": "tok"})
    assert response.status_code == 200
    body = response.json()
    assert body["requires_role"] is True
    assert body["email"] == "nuevo@gmail.com"
    assert body["full_name"] == "Nuevo Usuario"

    # No se creó cuenta: un intento de registro normal con ese email debe
    # poder hacerse sin chocar con un 409.
    register_response = await register_user(
        client, email="nuevo@gmail.com", full_name="Nuevo Usuario"
    )
    assert register_response.status_code == 201


async def test_google_login_new_user_with_role_creates_account(client: AsyncClient):
    """Email nuevo + rol elegido: da de alta la cuenta y devuelve tokens."""
    _override_verifier(
        _FakeGoogleVerifier(
            GoogleIdentity(email="nuevo2@gmail.com", email_verified=True, full_name="Nuevo Dos")
        )
    )
    response = await client.post(
        "/api/v1/auth/google", json={"id_token": "tok", "role": "worker"}
    )
    assert response.status_code == 200
    tokens = response.json()
    assert tokens["access_token"]
    assert "refresh_token" not in tokens
    assert response.cookies.get("staffya_refresh")

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "nuevo2@gmail.com"
    assert body["full_name"] == "Nuevo Dos"
    assert body["role"] == "worker"
    # Google ya verificó el email: la cuenta nace verificada.
    assert body["is_verified"] is True


async def test_google_login_existing_user_logs_in(client: AsyncClient):
    """Email con cuenta previa (registrada por contraseña): sesión normal,
    sin duplicar la cuenta ni requerir rol."""
    await register_user(client, email="mozo@staffya.com", full_name="Juan Mozo", role="worker")

    _override_verifier(
        _FakeGoogleVerifier(
            GoogleIdentity(email="mozo@staffya.com", email_verified=True, full_name="Juan Mozo")
        )
    )
    # Se manda `role` para probar que se ignora cuando el email ya existe.
    response = await client.post(
        "/api/v1/auth/google", json={"id_token": "tok", "role": "employer"}
    )
    assert response.status_code == 200
    tokens = response.json()
    assert tokens["access_token"]

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "mozo@staffya.com"
    # El rol sigue siendo el del registro original: /auth/google nunca lo cambia.
    assert body["role"] == "worker"


async def test_google_login_invalid_token(client: AsyncClient):
    _override_verifier(_FakeGoogleVerifier(error=GoogleTokenInvalidError()))
    response = await client.post("/api/v1/auth/google", json={"id_token": "invalido"})
    assert response.status_code == 401


async def test_google_login_email_not_verified(client: AsyncClient):
    _override_verifier(
        _FakeGoogleVerifier(
            GoogleIdentity(email="sinverificar@gmail.com", email_verified=False, full_name="X")
        )
    )
    response = await client.post("/api/v1/auth/google", json={"id_token": "tok"})
    assert response.status_code == 401


async def test_google_login_not_configured(client: AsyncClient):
    """Sin GOOGLE_CLIENT_ID configurado (flag por ausencia): 503, no 500."""
    _override_verifier(_FakeGoogleVerifier(error=GoogleAuthNotConfiguredError()))
    response = await client.post("/api/v1/auth/google", json={"id_token": "tok"})
    assert response.status_code == 503


async def test_google_account_has_no_usable_local_password(client: AsyncClient):
    """La cuenta creada vía Google no tiene contraseña local utilizable:
    intentar entrar por `/auth/login` para ese email falla con 401 limpio,
    nunca con un error de servidor (ver `_google_local_password`)."""
    _override_verifier(
        _FakeGoogleVerifier(
            GoogleIdentity(
                email="sologoogle@gmail.com", email_verified=True, full_name="Solo Google"
            )
        )
    )
    created = await client.post(
        "/api/v1/auth/google", json={"id_token": "tok", "role": "worker"}
    )
    assert created.status_code == 200

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "sologoogle@gmail.com", "password": "cualquier-cosa-123"},
    )
    assert login_response.status_code == 401
