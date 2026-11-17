"""U101: el alta pide la fecha de nacimiento y no deja entrar a menores de 18.

Decisión de Julieta del 2026-11-17 (docs/planning/BETA_TABLERO.md, etapa 3).
Las dos altas públicas (email y Google) la exigen; las internas (seed,
invitadas) no aceptan términos y no la piden.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.edad import edad_en, validar_fecha_nacimiento
from app.modules.identity.domain.exceptions import (
    BirthDateInvalidError,
    BirthDateRequiredError,
    UnderageError,
)
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from app.modules.identity.infrastructure.models import UserModel
from tests.conftest import register_user

HOY = date(2026, 11, 17)


# --- Regla pura ---------------------------------------------------------------


def test_cumple_18_hoy_puede():
    assert validar_fecha_nacimiento(date(2008, 11, 17), HOY) == date(2008, 11, 17)


def test_cumple_18_manana_no_puede():
    with pytest.raises(UnderageError):
        validar_fecha_nacimiento(date(2008, 11, 18), HOY)


def test_sin_fecha_no_hay_alta():
    with pytest.raises(BirthDateRequiredError):
        validar_fecha_nacimiento(None, HOY)


@pytest.mark.parametrize("fecha", [date(2026, 11, 18), date(1925, 1, 1), date(1095, 5, 20)])
def test_fecha_futura_o_imposible(fecha):
    with pytest.raises(BirthDateInvalidError):
        validar_fecha_nacimiento(fecha, HOY)


def test_29_de_febrero_cumple_el_1_de_marzo():
    nacimiento = date(2008, 2, 29)
    assert edad_en(nacimiento, date(2026, 2, 28)) == 17
    assert edad_en(nacimiento, date(2026, 3, 1)) == 18


# --- Alta con email -------------------------------------------------------------


@pytest.mark.asyncio
async def test_registro_sin_fecha_responde_422_claro(client: AsyncClient):
    response = await register_user(client, email="sinfecha@oido.com.ar", birth_date=None)
    assert response.status_code == 422
    assert response.json()["detail"] == "Para crear la cuenta necesitamos tu fecha de nacimiento"


@pytest.mark.asyncio
async def test_registro_de_menor_no_crea_la_cuenta(client: AsyncClient, session_factory):
    response = await register_user(client, email="menor@oido.com.ar", birth_date="2012-03-01")
    assert response.status_code == 422
    assert response.json()["detail"] == "Oído es sólo para mayores de 18 años"
    async with session_factory() as session:
        creada = await session.execute(
            select(UserModel).where(UserModel.email == "menor@oido.com.ar")
        )
        assert creada.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_registro_guarda_la_fecha_y_no_la_muestra(client: AsyncClient, session_factory):
    response = await register_user(client, email="adulta@oido.com.ar", birth_date="1990-07-09")
    assert response.status_code == 201
    assert "birth_date" not in response.json()
    async with session_factory() as session:
        model = (
            await session.execute(select(UserModel).where(UserModel.email == "adulta@oido.com.ar"))
        ).scalar_one()
        assert model.birth_date == date(1990, 7, 9)


# --- Alta con Google ------------------------------------------------------------


class _Verifier(GoogleTokenVerifier):
    async def verify(self, id_token: str) -> GoogleIdentity:
        return GoogleIdentity(email="menor@gmail.com", email_verified=True, full_name="Menor")


@pytest.fixture
def google_menor():
    app.dependency_overrides[get_google_verifier] = lambda: _Verifier()
    yield
    app.dependency_overrides.pop(get_google_verifier, None)


@pytest.mark.asyncio
async def test_google_sin_rol_no_pide_fecha_todavia(client: AsyncClient, google_menor):
    """El primer paso (sin rol) sólo pregunta el rol: la fecha va con él."""
    response = await client.post("/api/v1/auth/google", json={"id_token": "tok"})
    assert response.status_code == 200
    assert response.json()["requires_role"] is True


@pytest.mark.asyncio
async def test_google_de_menor_no_crea_la_cuenta(client: AsyncClient, google_menor):
    response = await client.post(
        "/api/v1/auth/google",
        json={"id_token": "tok", "role": "worker", "accepted_terms": True, "birth_date": "2010-01-01"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Oído es sólo para mayores de 18 años"


@pytest.mark.asyncio
async def test_google_sin_fecha_no_crea_la_cuenta(client: AsyncClient, google_menor):
    response = await client.post(
        "/api/v1/auth/google", json={"id_token": "tok", "role": "worker", "accepted_terms": True}
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Para crear la cuenta necesitamos tu fecha de nacimiento"
