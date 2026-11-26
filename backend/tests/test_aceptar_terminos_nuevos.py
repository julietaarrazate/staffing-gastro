"""Aceptar una versión nueva de los términos con la cuenta ya creada.

La app guardaba qué versión aceptó cada persona al registrarse, pero cuando
los términos cambiaban no se lo pedía a quien ya tenía cuenta: quedaba con
una versión vieja aceptada (decisión de Julieta, 2026-11-26)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.modules.identity.domain.value_objects import LEGAL_TERMS_VERSION
from app.modules.identity.infrastructure.models import TermsAcceptanceModel
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _me(client: AsyncClient, headers: dict) -> dict:
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def _versiones(session_factory, user_id: str) -> list[tuple[str, str]]:
    async with session_factory() as session:
        filas = (await session.execute(select(TermsAcceptanceModel))).scalars().all()
    return sorted((f.version, f.channel) for f in filas if str(f.user_id) == user_id)


async def test_quien_acepto_la_version_vigente_al_registrarse_no_tiene_que_aceptar_nada(
    client: AsyncClient,
):
    headers = await auth_headers(client, "worker", "terms_w1@staffya.com")
    assert (await _me(client, headers))["terms_acceptance_required"] is False


async def test_si_los_terminos_cambiaron_se_le_pide_aceptar_y_queda_constancia(
    client: AsyncClient, session_factory
):
    headers = await auth_headers(client, "employer", "terms_e1@staffya.com")
    user_id = (await _me(client, headers))["id"]
    # Su aceptación es de una versión anterior.
    async with session_factory() as session:
        await session.execute(update(TermsAcceptanceModel).values(version="2026-01-01-1"))
        await session.commit()

    assert (await _me(client, headers))["terms_acceptance_required"] is True

    aceptar = await client.post("/api/v1/auth/terms/accept", headers=headers)
    assert aceptar.status_code == 204
    assert (await _me(client, headers))["terms_acceptance_required"] is False
    # La anterior queda como historia y la nueva dice que fue desde la app.
    assert await _versiones(session_factory, user_id) == [
        ("2026-01-01-1", "email"),
        (LEGAL_TERMS_VERSION, "app"),
    ]

    # Aceptar de nuevo no escribe otra fila.
    await client.post("/api/v1/auth/terms/accept", headers=headers)
    assert len(await _versiones(session_factory, user_id)) == 2


async def test_aceptar_pide_sesion(client: AsyncClient):
    response = await client.post("/api/v1/auth/terms/accept")
    assert response.status_code == 401
