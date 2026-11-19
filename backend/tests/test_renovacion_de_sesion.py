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
        replaced_by="sucesora-de-prueba" if rotated_at else None,
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


def test_sin_sucesora_anotada_no_hay_gracia():
    """Una rotada sin `replaced_by` (no la escribe ningún camino actual) no
    tiene a quién revocar: no hay gracia."""
    ahora = datetime.now(timezone.utc)
    sin_sucesora = _sesion(ahora - timedelta(seconds=1))
    sin_sucesora.replaced_by = None
    assert not sin_sucesora.rotated_within_grace(ahora)


def test_compara_aunque_la_base_devuelva_fechas_sin_zona():
    """SQLite devuelve las fechas sin zona horaria; Postgres, con."""
    ahora = datetime.now(timezone.utc)
    sin_zona = (ahora - timedelta(seconds=5)).replace(tzinfo=None)
    assert _sesion(sin_zona).rotated_within_grace(ahora)


# --- SES-01: la respuesta que no llegó -------------------------------------


async def _sesion_de(session_factory, cookie: str) -> RefreshSession:
    async with session_factory() as base:
        sesion = await SqlAlchemyRefreshSessionRepository(base).get_by_jti(
            decode_token(cookie)["jti"]
        )
    assert sesion is not None
    return sesion


async def test_renovacion_con_respuesta_perdida_no_cierra_ningun_dispositivo(
    client: AsyncClient, session_factory
):
    """El celular renueva, el servidor rota, pero la respuesta no llega (el
    navegador se suspendió): reintenta con la cookie vieja. Dentro de la
    ventana recibe un par nuevo, la sucesora que nunca le llegó queda
    revocada, y la compu sigue con su sesión."""
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

    # La sucesora que se perdió no queda viva 30 días sin dueño.
    huerfana = await _sesion_de(session_factory, perdida.cookies.get(COOKIE))
    assert huerfana.is_revoked and huerfana.rotated_at is None
    original = await _sesion_de(session_factory, cookie_celular)
    assert original.replaced_by == decode_token(cookie_nueva)["jti"]


async def test_la_ventana_sirve_una_sola_vez(client: AsyncClient):
    """Un segundo reuso del mismo token dentro de los 30 s ya es robo: se
    cierran todas las sesiones, también la que dio la ventana."""
    await register_user(client)
    await login(client, EMAIL)
    viejo = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        assert (await refresh_with_cookie(viejo)).status_code == 200
        primero = await refresh_with_cookie(viejo)
        assert primero.status_code == 200

        assert (await refresh_with_cookie(viejo)).status_code == 401
        assert (await refresh_with_cookie(primero.cookies.get(COOKIE))).status_code == 401
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 401


# --- CON-02: dos pestañas que chocan ---------------------------------------


async def test_dos_pestanas_que_chocan_no_cierran_la_sesion_del_celular(
    client: AsyncClient, session_factory
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

        # La cookie es una sola: queda la de la respuesta que llegó última
        # (la 2). La de la 1 quedó revocada; su access token sigue valiendo
        # sus 15 minutos.
        assert (await refresh_with_cookie(pestana_2.cookies.get(COOKIE))).status_code == 200
        assert (await _sesion_de(session_factory, pestana_1.cookies.get(COOKIE))).is_revoked
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


async def test_salir_con_la_sucesora_le_quita_la_ventana_al_token_anterior(
    client: AsyncClient,
):
    """Renueva (R1 → R2), sale con R2, y alguien trae R1 dentro de los 30 s:
    la sucesora ya no está viva, así que no hay gracia. Es robo."""
    await register_user(client)
    await login(client, EMAIL)
    r1 = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        assert (await client.post("/api/v1/auth/refresh")).status_code == 200
        assert (await client.post("/api/v1/auth/logout")).status_code == 204

        assert (await refresh_with_cookie(r1)).status_code == 401
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


async def test_revocar_todo_no_toca_las_rotadas_fuera_del_plazo(
    client: AsyncClient, session_factory
):
    """La revocación en bloque le quita la ventana sólo a las rotadas dentro
    del plazo; en las más viejas `rotated_at` queda como registro."""
    await register_user(client)
    await login(client, EMAIL)
    viejo = client.cookies.get(COOKIE)
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200
    await pasar_la_ventana_de_gracia(session_factory)

    async with session_factory() as base:
        sesiones = SqlAlchemyRefreshSessionRepository(base)
        await sesiones.revoke_all_for_user((await sesiones.get_by_jti(
            decode_token(viejo)["jti"]
        )).user_id)
    assert (await _sesion_de(session_factory, viejo)).rotated_at is not None


# --- CON-03: dos renovaciones a la vez -------------------------------------


def _sucesora(user_id) -> RefreshSession:
    return RefreshSession(
        user_id=user_id,
        jti=f"sucesora-{uuid4().hex[:8]}",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )


async def test_rotar_es_atomico_de_dos_lecturas_gana_una(
    client: AsyncClient, session_factory
):
    """Dos pedidos con la misma cookie leen la sesión viva, cada uno en su
    sesión de base; el UPDATE condicional deja rotar a uno solo, y sólo la
    sucesora del que ganó queda guardada."""
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
        sucesora_a, sucesora_b = _sucesora(leida_a.user_id), _sucesora(leida_b.user_id)
        assert await repo_a.rotate(jti, ahora, sucesora_a) is True
        assert await repo_b.rotate(jti, ahora, sucesora_b) is False

        # La que perdió vuelve a leer y ve la rotación de la otra.
        releida = await repo_b.get_by_jti(jti)
        assert releida.is_revoked
        assert releida.replaced_by == sucesora_a.jti
        assert releida.rotated_within_grace(datetime.now(timezone.utc))
        assert await repo_b.get_by_jti(sucesora_a.jti) is not None
        assert await repo_b.get_by_jti(sucesora_b.jti) is None


async def test_una_sesion_cerrada_no_se_rota(client: AsyncClient, session_factory):
    await register_user(client)
    await login(client, EMAIL)
    jti = decode_token(client.cookies.get(COOKIE))["jti"]
    assert (await client.post("/api/v1/auth/logout")).status_code == 204

    async with session_factory() as base:
        repo = SqlAlchemyRefreshSessionRepository(base)
        cerrada = await repo.get_by_jti(jti)
        sucesora = _sucesora(cerrada.user_id)
        assert await repo.rotate(jti, datetime.now(timezone.utc), sucesora) is False
        assert (await repo.get_by_jti(jti)).rotated_at is None
        assert await repo.get_by_jti(sucesora.jti) is None


async def test_usar_la_ventana_es_atomico_de_dos_lecturas_gana_una(
    client: AsyncClient, session_factory
):
    await register_user(client)
    await login(client, EMAIL)
    viejo = client.cookies.get(COOKIE)
    assert (await client.post("/api/v1/auth/refresh")).status_code == 200
    jti = decode_token(viejo)["jti"]

    async with session_factory() as base_a, session_factory() as base_b:
        repo_a = SqlAlchemyRefreshSessionRepository(base_a)
        repo_b = SqlAlchemyRefreshSessionRepository(base_b)
        leida_a = await repo_a.get_by_jti(jti)
        leida_b = await repo_b.get_by_jti(jti)
        ahora = datetime.now(timezone.utc)
        assert leida_a.rotated_within_grace(ahora) and leida_b.rotated_within_grace(ahora)

        sucesora_a, sucesora_b = _sucesora(leida_a.user_id), _sucesora(leida_b.user_id)
        assert await repo_a.use_rotation_grace(leida_a, ahora, sucesora_a) is True
        assert await repo_b.use_rotation_grace(leida_b, ahora, sucesora_b) is False

        releida = await repo_b.get_by_jti(jti)
        assert releida.rotated_at is None and releida.replaced_by == sucesora_a.jti
        assert (await repo_b.get_by_jti(leida_a.replaced_by)).is_revoked
        assert await repo_b.get_by_jti(sucesora_b.jti) is None


def _cruzar_dos_renovaciones(monkeypatch) -> None:
    """Fija el orden de dos pedidos pegados: los dos leen la sesión antes de
    que el primero escriba, y el segundo sigue cuando el primero ya guardó su
    par. Con eventos, porque SQLite en memoria no aguanta dos transacciones
    intercaladas de verdad."""
    leidas = 0
    segunda_leyo = asyncio.Event()
    primera_termino = asyncio.Event()
    original_get = SqlAlchemyRefreshSessionRepository.get_by_jti

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

    def avisa(original):
        async def envuelto(self, *args, **kwargs):
            hecho = await original(self, *args, **kwargs)
            primera_termino.set()
            return hecho

        return envuelto

    monkeypatch.setattr(SqlAlchemyRefreshSessionRepository, "get_by_jti", get_by_jti)
    for metodo in ("rotate", "use_rotation_grace"):
        original = getattr(SqlAlchemyRefreshSessionRepository, metodo)
        monkeypatch.setattr(SqlAlchemyRefreshSessionRepository, metodo, avisa(original))


async def test_dos_renovaciones_simultaneas_la_segunda_entra_como_reuso(
    client: AsyncClient, session_factory, monkeypatch
):
    """La que pierde la carrera no rota de nuevo: entra por el camino del
    reuso y usa la ventana. Las dos reciben su par, la sucesora de la
    primera queda revocada (antes quedaban dos sesiones vivas del mismo
    token) y no se corta nada más."""
    await register_user(client)
    await login(client, EMAIL)
    cookie = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        _cruzar_dos_renovaciones(monkeypatch)
        respuestas = await asyncio.gather(
            refresh_with_cookie(cookie), refresh_with_cookie(cookie)
        )
        monkeypatch.undo()
        assert [r.status_code for r in respuestas] == [200, 200]
        sesiones = [
            await _sesion_de(session_factory, r.cookies.get(COOKIE)) for r in respuestas
        ]
        assert sorted(s.is_revoked for s in sesiones) == [False, True]
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 200


async def test_dos_pedidos_a_la_vez_dentro_de_la_ventana_dan_un_solo_par(
    client: AsyncClient, monkeypatch
):
    """Dos pedidos con el token ya rotado, a la vez: la ventana la usa uno
    solo. El otro es robo, y se cierra todo (también lo que dio la ventana)."""
    await register_user(client)
    await login(client, EMAIL)
    viejo = client.cookies.get(COOKIE)

    async with _otro_dispositivo() as celular:
        assert (await client.post("/api/v1/auth/refresh")).status_code == 200
        _cruzar_dos_renovaciones(monkeypatch)
        respuestas = await asyncio.gather(
            refresh_with_cookie(viejo), refresh_with_cookie(viejo)
        )
        monkeypatch.undo()
        # Cuál de los dos llega primero a la base no depende del orden del
        # `gather` (con la suite completa a veces gana el segundo).
        ganadora, rechazada = sorted(respuestas, key=lambda r: r.status_code)
        assert [ganadora.status_code, rechazada.status_code] == [200, 401]
        assert (await refresh_with_cookie(ganadora.cookies.get(COOKIE))).status_code == 401
        assert (await celular.post("/api/v1/auth/refresh")).status_code == 401
