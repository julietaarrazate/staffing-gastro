"""Constancia de aceptación de términos y privacidad (`terms_acceptances`).

Hasta el 2026-09-26 el checkbox del registro sólo trababa el botón en el
frontend: el backend creaba la cuenta igual y no guardaba nada. Estos tests
fijan que crear una cuenta, con email o con Google, exige la aceptación y deja
la fila con la versión vigente y el medio.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from app.modules.identity.domain.value_objects import LEGAL_TERMS_VERSION
from app.modules.identity.infrastructure.models import TermsAcceptanceModel, UserModel
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


class _FakeGoogleVerifier(GoogleTokenVerifier):
    def __init__(self, email: str) -> None:
        self._email = email

    async def verify(self, id_token: str) -> GoogleIdentity:
        return GoogleIdentity(email=self._email, email_verified=True, full_name="Con Google")


@pytest.fixture(autouse=True)
def _clear_google_override():
    yield
    app.dependency_overrides.pop(get_google_verifier, None)


async def _acceptances(
    factory: async_sessionmaker[AsyncSession], email: str
) -> list[TermsAcceptanceModel]:
    async with factory() as session:
        result = await session.execute(
            select(TermsAcceptanceModel)
            .join(UserModel, UserModel.id == TermsAcceptanceModel.user_id)
            .where(UserModel.email == email)
        )
        return list(result.scalars().all())


async def _user_exists(factory: async_sessionmaker[AsyncSession], email: str) -> bool:
    async with factory() as session:
        result = await session.execute(select(UserModel.id).where(UserModel.email == email))
        return result.first() is not None


async def test_register_without_terms_is_rejected(client: AsyncClient, session_factory):
    response = await register_user(client, email="sin@staffya.com", accepted_terms=False)
    assert response.status_code == 422
    assert "términos" in response.json()["detail"]
    assert not await _user_exists(session_factory, "sin@staffya.com")


async def test_register_records_acceptance(client: AsyncClient, session_factory):
    response = await register_user(client, email="con@staffya.com")
    assert response.status_code == 201

    [acceptance] = await _acceptances(session_factory, "con@staffya.com")
    assert acceptance.version == LEGAL_TERMS_VERSION
    assert acceptance.channel == "email"
    assert acceptance.accepted_at is not None


async def test_google_new_account_without_terms_is_rejected(
    client: AsyncClient, session_factory
):
    app.dependency_overrides[get_google_verifier] = lambda: _FakeGoogleVerifier("g1@gmail.com")
    response = await client.post(
        "/api/v1/auth/google", json={"id_token": "tok", "role": "worker"}
    )
    assert response.status_code == 422
    assert not await _user_exists(session_factory, "g1@gmail.com")


async def test_google_new_account_records_acceptance(client: AsyncClient, session_factory):
    app.dependency_overrides[get_google_verifier] = lambda: _FakeGoogleVerifier("g2@gmail.com")
    response = await client.post(
        "/api/v1/auth/google",
        json={"id_token": "tok", "role": "employer", "accepted_terms": True},
    )
    assert response.status_code == 200

    [acceptance] = await _acceptances(session_factory, "g2@gmail.com")
    assert acceptance.version == LEGAL_TERMS_VERSION
    assert acceptance.channel == "google"


async def test_google_existing_account_logs_in_without_asking_again(
    client: AsyncClient, session_factory
):
    """Entrar con Google a una cuenta que ya existe no vuelve a pedir la
    aceptación ni agrega otra fila."""
    await register_user(client, email="g3@gmail.com")
    app.dependency_overrides[get_google_verifier] = lambda: _FakeGoogleVerifier("g3@gmail.com")

    response = await client.post("/api/v1/auth/google", json={"id_token": "tok"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert len(await _acceptances(session_factory, "g3@gmail.com")) == 1
