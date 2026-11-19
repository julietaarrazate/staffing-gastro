"""Renovación de la sesión: rotación atómica y ventana de gracia (ADR-0002,
actualización 2026-11-19).

Hallazgos de la pasada por clase de error del 2026-11-19:
- CON-02: dos pestañas (o la PWA y una pestaña) renuevan casi a la vez; la
  segunda sale con la cookie que la primera acaba de rotar y el servidor lo
  tomaba por robo: cerraba la sesión en todos los dispositivos.
- CON-03: la rotación era leer y después escribir; dos renovaciones con el
  mismo token ganaban las dos y la detección de reuso no se enteraba.
- SES-01: si la respuesta de una renovación no llega (el celular se
  suspende, se corta la red), el reintento sale con la cookie vieja y se
  cerraban todas las sesiones, también la de ese dispositivo.
"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.security import decode_token
from app.modules.identity.application.services import IdentityService
from app.modules.identity.domain import entities
from app.modules.identity.domain.entities import REFRESH_ROTATION_GRACE, RefreshSession
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyRefreshSessionRepository,
)
from tests.conftest import (
    DEFAULT_PASSWORD,
    enroll_admin,
    login,
    new_client,
    pasar_la_ventana_de_gracia,
    refresh_with_cookie,
    register_user,
)
from tests.test_password_reset import _extract_token, fake_email_sender  # noqa: F401

pytestmark = pytest.mark.asyncio

EMAIL = "mozo@staffya.com"
COOKIE = "staffya_refresh"


@asynccontextmanager
async def _otro_dispositivo() -> AsyncIterator[AsyncClient]:
    """Otra sesión de la misma cuenta (otro dispositivo), con su cookie."""
    async with new_client() as otro:
        entro = await otro.post(
            "/api/v1/auth/login", json={"email": EMAIL, "password": DEFAULT_PASSWORD}
        )
        assert entro.status_code == 200
        yield otro


# --- Dominio: la ventana ---------------------------------------------------


def _sesion(rotated_at: datetime | None) -> RefreshSession:
    return RefreshSession(
        user_id=uuid4(),
        jti="sesion-de-prueba",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        revoked_at=rotated_at,
        rotated_at=rotated_at,
    )


def test_la_ventana_de_gracia_es_de_treinta_segundos():
    assert REFRESH_ROTATION_GRACE == timedelta(seconds=30)
    ahora = datetime.now(timezone.utc)
    assert _sesion(ahora - timedelta(seconds=30)).rotated_within_grace(ahora)
    assert not _sesion(ahora - timedelta(seconds=31)).rotated_within_grace(ahora)


def test_una_sesion_revocada_sin_rotar_no_tiene_gracia():
    """Cierre de sesión, contraseña nueva, suspensión o robo: `rotated_at`
    vacío, aunque la revocación sea de hace un segundo."""
    ahora = datetime.now(timezone.utc)
    cerrada = _sesion(None)
    cerrada.revoked_at = ahora - timedelta(seconds=1)
    assert not cerrada.rotated_within_grace(ahora)


def test_compara_aunque_la_base_devuelva_fechas_sin_zona():
    """SQLite devuelve las fechas sin zona horaria; Postgres, con."""
    ahora = datetime.now(timezone.utc)
    sin_zona = (ahora - timedelta(seconds=5)).replace(tzinfo=None)
    assert _sesion(sin_zona).rotated_within_grace(ahora)


# --- SES-01: la respuesta que no llegó -------------------------------------


async def test_renovacion_con_respuesta_perdida_no_cierra_ningun_dispositivo(
    client: AsyncClient,
):
    """El celular renueva, el servidor rota, pero la respuesta no llega (el
    navegador se suspendió): reintenta con la cookie vieja. Dentro de la
    ventana recibe un par nuevo, y la compu sigue con su sesión."""
    await register_user(client)
    await login(client, EMAIL)
    cookie_celular = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as compu:
        perdida = await refresh_with_cookie(cookie_celular)
        assert perdida.status_code == 200

        reintento = await refresh_with_cookie(cookie_celular)
        assert reintento.status_code == 200
        assert reintento.json()["access_token"]
        cookie_nueva = reintento.cookies.get(COOKIE)
        assert cookie_nueva and cookie_nueva != cookie_celular

        # El celular sigue renovando con lo que recibió en el reintento...
        siguiente = await refresh_with_cookie(cookie_nueva)
        assert siguiente.status_code == 200
        # ...y la compu no se enteró de nada.
        assert (await compu.post("/api/v1/auth/refresh")).status_code == 200


# --- CON-02: dos pestañas que chocan ---------------------------------------


async def test_dos_pestanas_que_chocan_no_cierran_la_sesion_del_celular(
    client: AsyncClient,
):
    await register_user(client)
    await login(client, EMAIL)
    cookie_del_navegador = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        # Pestaña 1 renueva; la pestaña 2 ya había salido con la cookie de
        # antes (la respuesta de la 1 todavía no llegó al navegador).
        pestana_1 = await refresh_with_cookie(cookie_del_navegador)
        assert pestana_1.status_code == 200
        pestana_2 = await refresh_with_cookie(cookie_del_navegador)
        assert pestana_2.status_code == 200

        # Quede la cookie que quede en el navegador, las dos sirven.
        assert (await refresh_with_cookie(pestana_1.cookies.get(COOKIE))).status_code == 200
        assert (await refresh_with_cookie(pestana_2.cookies.get(COOKIE))).status_code == 200
        # Y el celular, que no tuvo nada que ver, sigue adentro.
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 200


async def test_la_ventana_no_cambia_la_verificacion_en_dos_pasos(
    client: AsyncClient, session_factory
):
    """El par que da la ventana lleva el mismo `mfa` que el token: una sesión
    admin verificada sigue verificada (ADR-0023). Sale del claim del token,
    igual que en la rotación: una sin verificar tampoco se verifica sola."""
    await enroll_admin(client, session_factory, "ventana-verificada@oido.com.ar")
    verificada = client.cookies.get(COOKIE)
    assert (await refresh_with_cookie(verificada)).status_code == 200
    reintento = await refresh_with_cookie(verificada)
    assert reintento.status_code == 200
    panel = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {reintento.json()['access_token']}"},
    )
    assert panel.status_code == 200


# --- Lo que sigue siendo robo ----------------------------------------------


async def test_reuso_fuera_de_la_ventana_sigue_cerrando_todo(
    client: AsyncClient, session_factory
):
    await register_user(client)
    await login(client, EMAIL)
    viejo = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        assert (await client.post("/api/v1/auth/refresh")).status_code == 200
        await pasar_la_ventana_de_gracia(session_factory)

        assert (await refresh_with_cookie(viejo)).status_code == 401
        assert (await client.post("/api/v1/auth/refresh")).status_code == 401
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 401


async def test_token_cerrado_con_salir_no_tiene_gracia_aunque_sea_reciente(
    client: AsyncClient,
):
    """La gracia es sólo para el token ROTADO. Uno cerrado con «Salir» hace
    un segundo que vuelve a aparecer es robo: rechazo y se cierra todo."""
    await register_user(client)
    await login(client, EMAIL)
    cerrado = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        assert (await client.post("/api/v1/auth/logout")).status_code == 204

        assert (await refresh_with_cookie(cerrado)).status_code == 401
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 401


async def test_contrasena_nueva_le_quita_la_gracia_al_token_recien_rotado(
    client: AsyncClient, fake_email_sender  # noqa: F811
):
    """Quien tenga el token de hace unos segundos no vuelve a entrar después
    de que la cuenta cambió la contraseña (la revocación en bloque le gana a
    la ventana). Vale igual para la suspensión y la detección de robo, que
    usan el mismo `revoke_all_for_user`."""
    await register_user(client)
    await login(client, EMAIL)
    viejo = client.cookies.get(COOKIE)
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200

    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    token = _extract_token(fake_email_sender.sent[-1].html)
    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "la-clave-nueva-de-la-renovacion"},
    )
    assert reset.status_code == 204

    assert (await refresh_with_cookie(viejo)).status_code == 401


# --- CON-03: dos renovaciones a la vez -------------------------------------


async def test_rotar_es_atomico_de_dos_lecturas_gana_una(
    client: AsyncClient, session_factory
):
    """Dos pedidos con la misma cookie leen la sesión viva, cada uno en su
    sesión de base; el UPDATE condicional deja rotar a uno solo."""
    await register_user(client)
    await login(client, EMAIL)
    jti = decode_token(client.cookies.get(COOKIE))["jti"]

    async with session_factory() as base_a, session_factory() as base_b:
        repo_a = SqlAlchemyRefreshSessionRepository(base_a)
        repo_b = SqlAlchemyRefreshSessionRepository(base_b)
        leida_a = await repo_a.get_by_jti(jti)
        leida_b = await repo_b.get_by_jti(jti)
        assert not leida_a.is_revoked and not leida_b.is_revoked

        ahora = datetime.now(timezone.utc)
        assert await repo_a.rotate(jti, ahora) is True
        assert await repo_b.rotate(jti, ahora) is False

        # La que perdió vuelve a leer y ve la rotación de la otra.
        releida = await repo_b.get_by_jti(jti)
        assert releida.is_revoked
        assert releida.rotated_within_grace(datetime.now(timezone.utc))


async def test_una_sesion_cerrada_no_se_rota(client: AsyncClient, session_factory):
    await register_user(client)
    await login(client, EMAIL)
    jti = decode_token(client.cookies.get(COOKIE))["jti"]
    assert (await client.post("/api/v1/auth/logout")).status_code == 204

    async with session_factory() as base:
        repo = SqlAlchemyRefreshSessionRepository(base)
        assert await repo.rotate(jti, datetime.now(timezone.utc)) is False
        assert (await repo.get_by_jti(jti)).rotated_at is None


def _cruzar_dos_renovaciones(monkeypatch) -> None:
    """Fija el orden de dos pedidos pegados: los dos leen la sesión viva
    antes de que el primero la rote, y el segundo sigue cuando el primero ya
    emitió el par nuevo. Con eventos, porque SQLite en memoria no aguanta dos
    transacciones intercaladas de verdad."""
    leidas = 0
    segunda_leyo = asyncio.Event()
    primera_termino = asyncio.Event()
    original_get = SqlAlchemyRefreshSessionRepository.get_by_jti
    original_issue = IdentityService._issue_tokens

    async def get_by_jti(self, jti):
        nonlocal leidas
        result = await original_get(self, jti)
        leidas += 1
        if leidas == 1:
            await segunda_leyo.wait()
        elif leidas == 2:
            segunda_leyo.set()
            await primera_termino.wait()
        return result

    async def issue(self, *args, **kwargs):
        pair = await original_issue(self, *args, **kwargs)
        primera_termino.set()
        return pair

    monkeypatch.setattr(SqlAlchemyRefreshSessionRepository, "get_by_jti", get_by_jti)
    monkeypatch.setattr(IdentityService, "_issue_tokens", issue)


async def test_dos_renovaciones_simultaneas_la_segunda_entra_como_reuso(
    client: AsyncClient, monkeypatch
):
    """La que pierde la carrera no rota de nuevo: entra por el camino del
    reuso. Dentro de la ventana (siempre, en una carrera) recibe su par y no
    se corta nada."""
    await register_user(client)
    await login(client, EMAIL)
    cookie = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        _cruzar_dos_renovaciones(monkeypatch)
        primera, segunda = await asyncio.gather(
            refresh_with_cookie(cookie), refresh_with_cookie(cookie)
        )
        assert [primera.status_code, segunda.status_code] == [200, 200]
        assert primera.cookies.get(COOKIE) != segunda.cookies.get(COOKIE)
        monkeypatch.undo()
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 200


async def test_sin_ventana_la_segunda_de_dos_renovaciones_simultaneas_es_robo(
    client: AsyncClient, monkeypatch
):
    """La prueba de que la detección de reuso ahora SÍ se entera de la
    carrera (antes ganaban las dos): con la ventana en cero, la segunda se
    rechaza y se cierran todas las sesiones."""
    await register_user(client)
    await login(client, EMAIL)
    cookie = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        monkeypatch.setattr(entities, "REFRESH_ROTATION_GRACE", timedelta(0))
        _cruzar_dos_renovaciones(monkeypatch)
        respuestas = await asyncio.gather(
            refresh_with_cookie(cookie), refresh_with_cookie(cookie)
        )
        # Cuál de los dos llega primero a la base no depende del orden del
        # `gather` (con la suite completa a veces gana el segundo).
        ganadora, rechazada = sorted(respuestas, key=lambda r: r.status_code)
        assert [ganadora.status_code, rechazada.status_code] == [200, 401]
        monkeypatch.undo()
        assert (await refresh_with_cookie(ganadora.cookies.get(COOKIE))).status_code == 401
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 401
