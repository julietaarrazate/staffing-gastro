"""Origen de cada alta (fase 0 del plan de crecimiento, Julieta 2026-11-18).

El registro guarda de qué enlace llegó la persona (`?ref=`, o `utm_source` y
`utm_campaign`; «directo» si no traía nada) y «Métricas» del admin muestra
las altas del período por origen y por rol. Ver
`identity/domain/origen_alta.py`."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.modules.admin.application.services import TEST_ACCOUNTS, _signups_by_origin
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.application.services import GUEST_ACCOUNTS
from app.modules.identity.domain.origen_alta import (
    LARGO_MAXIMO_ETIQUETA,
    ORIGEN_DIRECTO,
    OrigenAlta,
    origen_de_alta_publica,
)
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from app.modules.identity.domain.repositories import SignupOriginCount
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import UserModel
from tests.conftest import make_admin, register_user

pytestmark = pytest.mark.asyncio


async def _origin_of(session_factory, email: str) -> str | None:
    async with session_factory() as session:
        return (
            await session.execute(select(UserModel.signup_origin).where(UserModel.email == email))
        ).scalar_one()


async def _set_created_at(session_factory, email: str, created_at: datetime) -> None:
    async with session_factory() as session:
        model = (
            await session.execute(select(UserModel).where(UserModel.email == email))
        ).scalar_one()
        model.created_at = created_at
        await session.commit()


# --- Dominio ----------------------------------------------------------------


async def test_ref_gana_sobre_utm():
    origen = OrigenAlta(ref="grupo-palermo", utm_source="ig", utm_campaign="fundadores")
    assert origen.etiqueta() == "grupo-palermo"


async def test_utm_source_con_campana_detras_de_una_barra():
    assert OrigenAlta(utm_source="ig", utm_campaign="fundadores").etiqueta() == "ig/fundadores"
    assert OrigenAlta(utm_source="ig").etiqueta() == "ig"
    assert OrigenAlta(utm_campaign="fundadores").etiqueta() == "fundadores"


async def test_sin_nada_es_directo():
    assert OrigenAlta().etiqueta() == ORIGEN_DIRECTO
    assert OrigenAlta(ref="  ", utm_source="").etiqueta() == ORIGEN_DIRECTO
    assert origen_de_alta_publica(None) == ORIGEN_DIRECTO


async def test_normaliza_mayusculas_tildes_y_espacios():
    assert OrigenAlta(ref=" Instagram ").etiqueta() == "instagram"
    assert OrigenAlta(ref="Volante Villa Crespo").etiqueta() == "volante-villa-crespo"
    assert OrigenAlta(ref="Peñón café").etiqueta() == "penon-cafe"


async def test_texto_raro_no_entra_al_panel():
    # Ni HTML ni barras ni comillas: sólo letras, números, punto y guiones.
    assert OrigenAlta(ref="<script>alert(1)</script>").etiqueta() == "script-alert-1-script"
    assert OrigenAlta(ref="../../etc").etiqueta() == "etc"
    # Lo que no deja nada útil cuenta como que no vino.
    assert OrigenAlta(ref="!!!", utm_source="ig").etiqueta() == "ig"


async def test_largo_acotado_entra_en_la_columna():
    larga = "a" * 500
    etiqueta = OrigenAlta(utm_source=larga, utm_campaign=larga).etiqueta()
    assert len(etiqueta) == LARGO_MAXIMO_ETIQUETA
    assert OrigenAlta(ref=larga).etiqueta() == "a" * 40


async def test_agrupa_por_origen_ordena_y_deja_sin_dato_al_final():
    rows = [
        SignupOriginCount(origin=None, role=UserRole.WORKER, count=9),
        SignupOriginCount(origin="directo", role=UserRole.WORKER, count=1),
        SignupOriginCount(origin="ig", role=UserRole.WORKER, count=2),
        SignupOriginCount(origin="ig", role=UserRole.EMPLOYER, count=1),
        SignupOriginCount(origin="grupo-palermo", role=UserRole.EMPLOYER, count=3),
    ]
    result = _signups_by_origin(rows)
    assert [(s.origin, s.workers, s.companies, s.total) for s in result] == [
        ("grupo-palermo", 0, 3, 3),
        ("ig", 2, 1, 3),
        ("directo", 1, 0, 1),
        (None, 9, 0, 9),
    ]


# --- Alta por email -----------------------------------------------------------


async def test_registro_guarda_el_origen_del_enlace(client: AsyncClient, session_factory):
    response = await register_user(
        client,
        email="ref@staffya.com",
        origen={"ref": "Grupo-Palermo", "utm_source": "ig"},
    )
    assert response.status_code == 201
    assert await _origin_of(session_factory, "ref@staffya.com") == "grupo-palermo"

    await register_user(
        client,
        email="utm@staffya.com",
        role="employer",
        origen={"utm_source": "ig", "utm_campaign": "fundadores"},
    )
    assert await _origin_of(session_factory, "utm@staffya.com") == "ig/fundadores"


async def test_registro_sin_origen_queda_directo(client: AsyncClient, session_factory):
    response = await register_user(client, email="directo@staffya.com")
    assert response.status_code == 201
    assert await _origin_of(session_factory, "directo@staffya.com") == ORIGEN_DIRECTO


async def test_un_origen_mal_formado_nunca_frena_el_alta(client: AsyncClient, session_factory):
    casos = {
        "lista@staffya.com": ["ig"],
        "texto@staffya.com": "ig",
        "numeros@staffya.com": {"ref": 123, "utm_source": None},
        "largo@staffya.com": {"ref": "x" * 5000},
    }
    for email, origen in casos.items():
        response = await register_user(client, email=email, origen=origen)
        assert response.status_code == 201, (email, response.text)
    assert await _origin_of(session_factory, "lista@staffya.com") == ORIGEN_DIRECTO
    assert await _origin_of(session_factory, "numeros@staffya.com") == ORIGEN_DIRECTO
    assert await _origin_of(session_factory, "largo@staffya.com") == "x" * 40


async def test_el_origen_no_sale_en_la_respuesta_ni_en_me(client: AsyncClient):
    response = await register_user(client, email="privado@staffya.com", origen={"ref": "ig"})
    assert "signup_origin" not in response.json()
    assert "origen" not in response.json()


# --- Alta con Google ------------------------------------------------------------


class _GoogleDePrueba(GoogleTokenVerifier):
    async def verify(self, id_token: str) -> GoogleIdentity:
        return GoogleIdentity(email="ana@gmail.com", email_verified=True, full_name="Ana Google")


async def test_alta_con_google_guarda_el_origen(client: AsyncClient, session_factory):
    app.dependency_overrides[get_google_verifier] = lambda: _GoogleDePrueba()
    try:
        response = await client.post(
            "/api/v1/auth/google",
            json={
                "id_token": "tok",
                "role": "worker",
                "accepted_terms": True,
                "birth_date": "1995-05-20",
                "origen": {"utm_source": "tiktok"},
            },
        )
        assert response.status_code == 200, response.text
        # Volver a entrar con otro enlace no cambia de dónde llegó.
        await client.post(
            "/api/v1/auth/google", json={"id_token": "tok", "origen": {"ref": "otro"}}
        )
    finally:
        app.dependency_overrides.pop(get_google_verifier, None)
    assert await _origin_of(session_factory, "ana@gmail.com") == "tiktok"


# --- Panel de admin -------------------------------------------------------------


async def test_metricas_muestran_altas_por_origen_y_rol(client: AsyncClient, session_factory):
    admin = await make_admin(client, session_factory, "admin-origen@staffya.com")
    await register_user(client, email="w1@staffya.com", origen={"ref": "grupo-palermo"})
    await register_user(client, email="w2@staffya.com", origen={"ref": "grupo-palermo"})
    await register_user(client, email="c1@staffya.com", role="employer", origen={"ref": "grupo-palermo"})
    await register_user(client, email="c2@staffya.com", role="employer", origen={"utm_source": "ig"})
    await register_user(client, email="w3@staffya.com")
    # Una cuenta de antes de que se guardara el origen.
    await register_user(client, email="vieja@staffya.com")
    async with session_factory() as session:
        model = (
            await session.execute(select(UserModel).where(UserModel.email == "vieja@staffya.com"))
        ).scalar_one()
        model.signup_origin = None
        await session.commit()
    # Fuera del período: no cuenta.
    await register_user(client, email="antigua@staffya.com", origen={"ref": "grupo-palermo"})
    await _set_created_at(
        session_factory, "antigua@staffya.com", datetime.now(UTC) - timedelta(days=40)
    )
    # Las cuentas de prueba e invitadas no cuentan, aunque traigan origen.
    await register_user(client, email=TEST_ACCOUNTS[UserRole.WORKER][0], origen={"ref": "ig"})
    await register_user(
        client, email=GUEST_ACCOUNTS[UserRole.EMPLOYER][0], role="employer", origen={"ref": "ig"}
    )

    response = await client.get("/api/v1/admin/period-metrics?period=30", headers=admin)
    assert response.status_code == 200
    rows = response.json()["signups_by_origin"]
    assert rows == [
        {"origin": "grupo-palermo", "workers": 2, "companies": 1, "total": 3},
        # La admin se dio de alta como comercio y después la promovieron: no cuenta.
        {"origin": "directo", "workers": 1, "companies": 0, "total": 1},
        {"origin": "ig", "workers": 0, "companies": 1, "total": 1},
        {"origin": None, "workers": 1, "companies": 0, "total": 1},
    ]


async def test_altas_por_origen_solo_para_admin(client: AsyncClient):
    response = await register_user(client, email="curioso@staffya.com")
    assert response.status_code == 201
    tokens = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "curioso@staffya.com", "password": "supersecreta123"},
        )
    ).json()
    response = await client.get(
        "/api/v1/admin/period-metrics?period=7",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 403
