"""Tests de integración de la verificación de email (verify/resend)."""

import re
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.modules.identity.infrastructure.models import EmailVerificationTokenModel
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
    """Mismo doble que en test_password_reset.py, para capturar el email de
    verificación que se manda al registrarse."""
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_email_sender, None)


async def _set_token_field(
    session_factory: async_sessionmaker[AsyncSession], **values
) -> None:
    async with session_factory() as session:
        result = await session.execute(select(EmailVerificationTokenModel))
        model = result.scalars().first()
        assert model is not None
        for key, value in values.items():
            setattr(model, key, value)
        await session.commit()


async def test_register_sends_verification_email(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    response = await register_user(client, email="nuevo@staffya.com")
    assert response.status_code == 201
    assert response.json()["is_verified"] is False

    assert len(fake_email_sender.sent) == 1
    assert fake_email_sender.sent[0].to == "nuevo@staffya.com"


async def test_verify_email_with_valid_token_marks_user_verified(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    await register_user(client, email="verifica@staffya.com")
    token = _extract_token(fake_email_sender.sent[0].html)

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 204

    tokens = await login(client, "verifica@staffya.com")
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.json()["is_verified"] is True


async def test_verify_email_invalid_token_returns_400(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/verify-email", json={"token": "un-token-inventado"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Enlace inválido o vencido"


async def test_verify_email_expired_token_returns_400(
    client: AsyncClient,
    fake_email_sender: FakeEmailSender,
    session_factory: async_sessionmaker[AsyncSession],
):
    await register_user(client, email="vencido@staffya.com")
    token = _extract_token(fake_email_sender.sent[0].html)

    await _set_token_field(
        session_factory, expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)
    )

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 400


async def test_verify_email_used_token_cannot_be_reused(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    await register_user(client, email="usado@staffya.com")
    token = _extract_token(fake_email_sender.sent[0].html)

    first = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert first.status_code == 204

    second = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert second.status_code == 400


async def test_resend_verification_nonexistent_email_returns_202_and_sends_nothing(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "no-existe@staffya.com"}
    )
    assert response.status_code == 202
    assert fake_email_sender.sent == []


async def test_resend_verification_already_verified_sends_nothing(
    client: AsyncClient,
    fake_email_sender: FakeEmailSender,
    session_factory: async_sessionmaker[AsyncSession],
):
    """Confirmar el email dispara, además del email de confirmación (al
    registrarse), el de bienvenida — una sola vez, al confirmar por primera
    vez (ver `_send_welcome_email`). Por eso acá ya hay 2 antes de pedir el
    reenvío, no 1: lo que este test protege es que el reenvío posterior no
    sume un tercero."""
    await register_user(client, email="yaverificado@staffya.com")
    token = _extract_token(fake_email_sender.sent[0].html)
    await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert len(fake_email_sender.sent) == 2
    assert "Bienvenido" in fake_email_sender.sent[1].subject

    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "yaverificado@staffya.com"}
    )
    assert response.status_code == 202
    assert len(fake_email_sender.sent) == 2


async def test_resend_verification_is_silently_rate_limited(
    client: AsyncClient, fake_email_sender: FakeEmailSender
):
    """Un segundo pedido dentro de la ventana de 5 minutos no genera ni manda
    otro email (silencioso: sigue respondiendo 202 igual)."""
    await register_user(client, email="reenvio@staffya.com")
    assert len(fake_email_sender.sent) == 1

    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "reenvio@staffya.com"}
    )
    assert response.status_code == 202
    assert len(fake_email_sender.sent) == 1


async def test_resend_verification_after_window_sends_new_token(
    client: AsyncClient,
    fake_email_sender: FakeEmailSender,
    session_factory: async_sessionmaker[AsyncSession],
):
    await register_user(client, email="reenvio2@staffya.com")
    old_token = _extract_token(fake_email_sender.sent[0].html)

    await _set_token_field(
        session_factory, created_at=datetime.now(timezone.utc) - timedelta(minutes=10)
    )

    response = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "reenvio2@staffya.com"}
    )
    assert response.status_code == 202
    assert len(fake_email_sender.sent) == 2
    new_token = _extract_token(fake_email_sender.sent[1].html)
    assert new_token != old_token

    verify = await client.post("/api/v1/auth/verify-email", json={"token": new_token})
    assert verify.status_code == 204
