"""Origin en endpoints con cookie de refresh y forma de los 422."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from tests.conftest import login, register_user

pytestmark = pytest.mark.asyncio

ALLOWED = settings.cors_origins_list[0]


async def test_refresh_con_origen_permitido(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    r = await client.post("/api/v1/auth/refresh", headers={"Origin": ALLOWED})
    assert r.status_code == 200


async def test_refresh_con_origen_ajeno_403(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    r = await client.post("/api/v1/auth/refresh", headers={"Origin": "https://otro.example"})
    assert r.status_code == 403


async def test_refresh_sin_origen_pasa(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200


async def test_logout_origen_ajeno_403_y_no_revoca(client: AsyncClient):
    await register_user(client)
    await login(client, "mozo@staffya.com")
    bad = await client.post("/api/v1/auth/logout", headers={"Origin": "https://otro.example"})
    assert bad.status_code == 403
    ok = await client.post("/api/v1/auth/logout", headers={"Origin": ALLOWED})
    assert ok.status_code == 204
    assert (await client.post("/api/v1/auth/logout")).status_code == 204


async def test_422_no_devuelve_input_ni_ctx(client: AsyncClient):
    r = await client.post(
        "/api/v1/auth/login", json={"email": "no-es-mail", "password": "secreto-que-no-debe-volver"}
    )
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert errors
    for e in errors:
        assert set(e) <= {"type", "loc", "msg", "ctx"}
        assert "input" not in e
    assert "secreto-que-no-debe-volver" not in r.text
    assert "no-es-mail" not in r.text


async def test_422_sólo_devuelve_las_cotas_numéricas_del_esquema(client: AsyncClient):
    """G8: la app traduce «máximo 128 caracteres» con las cotas del esquema;
    del `ctx` no viaja nada más (ni el texto de un validador, que puede
    repetir lo que se mandó)."""
    clave_larga = "x" * 200
    r = await client.post(
        "/api/v1/auth/login", json={"email": "a@b.com", "password": clave_larga}
    )
    if r.status_code != 422:  # el login no tiene tope: probar con el registro
        r = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "a@b.com",
                "password": clave_larga,
                "full_name": "Ana",
                "role": "worker",
                "accepted_terms": True,
            },
        )
    assert r.status_code == 422
    errors = r.json()["detail"]
    for e in errors:
        assert "input" not in e
        for clave, valor in e.get("ctx", {}).items():
            assert clave in {"min_length", "max_length", "ge", "le", "gt", "lt", "max_digits", "decimal_places"}
            assert isinstance(valor, int | float)
    assert clave_larga not in r.text
    assert any(e.get("ctx", {}).get("max_length") == 128 for e in errors)


async def test_422_de_un_mail_invalido_no_devuelve_el_motivo(client: AsyncClient):
    """El `ctx` crudo de un mail inválido trae `reason` (texto que puede
    repetir parte del dominio que se mandó): no tiene que viajar."""
    r = await client.post(
        "/api/v1/auth/login", json={"email": "ana@dominio-secreto", "password": "x"}
    )
    assert r.status_code == 422
    for e in r.json()["detail"]:
        ctx = e.get("ctx", {})
        assert "reason" not in ctx
        assert "error" not in ctx
        assert all(isinstance(v, int | float) for v in ctx.values())
    assert "dominio-secreto" not in r.text


def test_ctx_seguro_deja_pasar_sólo_cotas_numéricas():
    """Prueba directa del filtro con un `ctx` hostil: textos, la longitud de
    lo que se mandó (`actual_length`), un booleano disfrazado de cota y una
    cota como texto. Sólo sobrevive la cota numérica real."""
    from decimal import Decimal

    from app.main import _ctx_seguro

    hostil = {
        "error": "secreto",
        "reason": "dominio privado",
        "actual_length": 9,
        "max_length": True,
        "ge": "5",
        "le": 3,
        "gt": Decimal("0"),
    }
    assert _ctx_seguro(hostil) == {"le": 3, "gt": 0.0}
    assert _ctx_seguro({"le": float("inf"), "ge": float("nan"), "lt": 10}) == {"lt": 10}
    assert _ctx_seguro({"reason": "x"}) is None
    assert _ctx_seguro(None) is None
    assert _ctx_seguro("no es un dict") is None
