"""Tests de integración de la recuperación de contraseña (forgot/reset)."""

import re
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.modules.identity.infrastructure.models import PasswordResetTokenModel
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from tests.conftest import login, register_user

pytestmark = pytest.mark.asyncio

_TOKEN_RE = re.compile(r"token=([A-Za-z0-9_\-]+)")


def _extract_token(html: str) -> str:
    match = _TOKEN_RE.search(html)
    assert match is not None, f"no se encontró el token en el email: {html!r}"
    return match.group(1)


@pytest.fixture
def fake_email_sender():
    """Reemplaza el EmailSender real por un doble que captura los envíos,
    igual que `FakeBillingGateway` en tests/test_subscription.py."""
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_email_sender, None)


async def _set_token_field(
    session_factory: async_sessionmaker[AsyncSession], **values
) -> None:
    """Pisa un campo del (único) token de reset presente en la DB de test,
    para simular vencimiento/antigüedad sin esperar tiempo real."""
    async with session_factory() as session:
        result = await session.execute(select(PasswordResetTokenModel))
        model = result.scalars().first()
        assert model is not None
        for key, value in values.items():
            setattr(model, key, value)
        await session.commit()


async def test_forgot_password_nonexistent_email_returns_202_and_sends_nothing(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    """Anti-enumeración: un email que no existe responde igual (202) y no
    dispara ningún envío real."""
    response = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "no-existe@staffya.com"}
    )
    assert response.status_code == 202
    assert fake_email_sender.sent == []


async def test_forgot_password_existing_email_sends_link_and_reset_flow_works(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    await register_user(client, email="recupera@staffya.com", password="viejaClave123")

    response = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "recupera@staffya.com"}
    )
    assert response.status_code == 202
    # Mismo body genérico que el caso de email inexistente (no-disclosure).
    assert response.json()["message"]

    assert len(fake_email_sender.sent) == 1
    sent = fake_email_sender.sent[0]
    assert sent.to == "recupera@staffya.com"
    token = _extract_token(sent.html)

    reset_response = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "nuevaClave456"},
    )
    assert reset_response.status_code == 204

    # La contraseña vieja ya no sirve...
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "recupera@staffya.com", "password": "viejaClave123"},
    )
    assert old_login.status_code == 401

    # ...y la nueva sí.
    new_tokens = await login(client, "recupera@staffya.com", "nuevaClave456")
    assert new_tokens["access_token"]


async def test_reset_password_expired_token_returns_400(
    client: AsyncClient,
    fake_email_sender: FakeEmailSender,
    session_factory: async_sessionmaker[AsyncSession],
):
    await register_user(client, email="vencido@staffya.com")
    await client.post(
        "/api/v1/auth/forgot-password", json={"email": "vencido@staffya.com"}
    )
    token = _extract_token(fake_email_sender.sent[0].html)

    await _set_token_field(
        session_factory, expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)
    )

    response = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "otraClave789"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Enlace inválido o vencido"


async def test_reset_password_used_token_cannot_be_reused(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    await register_user(client, email="usado@staffya.com")
    await client.post("/api/v1/auth/forgot-password", json={"email": "usado@staffya.com"})
    token = _extract_token(fake_email_sender.sent[0].html)

    first = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "primeraClave1"},
    )
    assert first.status_code == 204

    second = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "segundaClave2"},
    )
    assert second.status_code == 400


async def test_reset_password_invalid_token_returns_400(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "un-token-inventado-que-no-existe", "new_password": "algoValido1"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Enlace inválido o vencido"


async def test_forgot_password_resend_is_silently_rate_limited(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    """Un segundo pedido dentro de la ventana de 5 minutos no genera ni manda
    otro email (silencioso: sigue respondiendo 202 igual)."""
    await register_user(client, email="reenvio@staffya.com")

    first = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "reenvio@staffya.com"}
    )
    assert first.status_code == 202
    second = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "reenvio@staffya.com"}
    )
    assert second.status_code == 202

    assert len(fake_email_sender.sent) == 1


async def test_reset_password_invalidates_previous_unused_token(
    client: AsyncClient,
    fake_email_sender: FakeEmailSender,
    session_factory: async_sessionmaker[AsyncSession],
):
    """Al completar un reset, un link anterior sin usar deja de servir."""
    await register_user(client, email="doslinks@staffya.com")

    await client.post(
        "/api/v1/auth/forgot-password", json={"email": "doslinks@staffya.com"}
    )
    old_token = _extract_token(fake_email_sender.sent[0].html)

    # Simula que pasaron >5 min para poder pedir un segundo link (si no, el
    # rate-limit de reenvío ni siquiera generaría uno nuevo).
    await _set_token_field(
        session_factory, created_at=datetime.now(timezone.utc) - timedelta(minutes=10)
    )

    await client.post(
        "/api/v1/auth/forgot-password", json={"email": "doslinks@staffya.com"}
    )
    assert len(fake_email_sender.sent) == 2
    new_token = _extract_token(fake_email_sender.sent[1].html)

    reset_with_new = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": new_token, "new_password": "claveFinal123"},
    )
    assert reset_with_new.status_code == 204

    # El link viejo (nunca usado) ya no sirve: quedó invalidado por el reset.
    reset_with_old = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": old_token, "new_password": "otraClave000"},
    )
    assert reset_with_old.status_code == 400


async def test_reset_password_revokes_active_refresh_sessions(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    """Al restablecer la contraseña se revocan las sesiones activas (OWASP):
    un refresh token emitido antes del reset deja de servir."""
    await register_user(client, email="revoca@staffya.com")
    tokens = await login(client, "revoca@staffya.com")

    await client.post(
        "/api/v1/auth/forgot-password", json={"email": "revoca@staffya.com"}
    )
    token = _extract_token(fake_email_sender.sent[0].html)

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "claveNueva123"},
    )
    assert reset.status_code == 204

    # La sesión previa al reset quedó revocada: el refresh viejo no renueva.
    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 401
