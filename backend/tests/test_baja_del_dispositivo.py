"""Baja del dispositivo (2026-11-18): `/privacidad` dice que el identificador
del dispositivo «se borra al desactivarlas y al cerrar sesión en ese
dispositivo». Tres caminos de servidor, uno por sección:

1. `POST /push/release`: la baja sin sesión, con la clave de la suscripción.
2. Suspender una cuenta borra sus dispositivos.
3. El barrido de la pasada de retención borra los de las cuentas que se
   quedaron sin sesión por una revocación (no los de quien sólo dejó vencer
   la sesión por no abrir la app).
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from app.main import app
from app.modules.admin.api.dependencies import _PushDeviceRemover
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.google_verifier import GoogleIdentity, GoogleTokenVerifier
from app.modules.identity.infrastructure.models import RefreshSessionModel
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.domain.entities import PushSubscription
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from app.modules.notification.infrastructure.device_sweep_job import (
    sweep_devices_of_revoked_accounts,
)
from app.modules.notification.infrastructure.models import PushSubscriptionModel
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyPushSubscriptionRepository,
)
from app.modules.shift.application import scheduler
from tests.conftest import (
    TEST_GUEST_PIN,
    auth_headers,
    current_totp,
    enroll_admin,
    login,
    make_admin,
    new_client,
    refresh_with_cookie,
    register_user,
)
from tests.test_cuentas_suspendidas import _suspend, _user_id
from tests.test_password_reset import _extract_token

pytestmark = pytest.mark.asyncio

API = "/api/v1"
SUBSCRIBE = f"{API}/push/subscribe"
RELEASE = f"{API}/push/release"

ENDPOINT = "https://fcm.googleapis.com/fcm/send/celular-compartido"
# Lo que manda siempre el mismo navegador para su endpoint.
CLAVES = {"p256dh": "p-del-navegador", "auth": "auth-del-navegador"}
# Legible a propósito: gitleaks escanea el historial de todas las ramas.
CLAVE_NUEVA = "la-clave-nueva-del-barrido"


async def _me(client: AsyncClient, headers: dict) -> UUID:
    return UUID((await client.get(f"{API}/auth/me", headers=headers)).json()["id"])


async def _subscribe(client: AsyncClient, headers: dict, endpoint: str = ENDPOINT) -> None:
    response = await client.post(
        SUBSCRIBE, json={"endpoint": endpoint, "keys": CLAVES}, headers=headers
    )
    assert response.status_code == 201, response.text


async def _release(client: AsyncClient, user_id, *, endpoint: str = ENDPOINT, auth: str = CLAVES["auth"]):
    """Como la manda el navegador: sin token ni cookie."""
    return await client.post(
        RELEASE, json={"endpoint": endpoint, "auth": auth, "user_id": str(user_id)}
    )


async def _owners(
    session_factory: async_sessionmaker[AsyncSession], endpoint: str = ENDPOINT
) -> list[UUID]:
    async with session_factory() as session:
        result = await session.execute(
            select(PushSubscriptionModel.user_id).where(
                PushSubscriptionModel.endpoint == endpoint
            )
        )
        return list(result.scalars().all())


async def _devices_of(session_factory, user_id: UUID) -> list[str]:
    async with session_factory() as session:
        subs = await SqlAlchemyPushSubscriptionRepository(session).list_by_user(user_id)
    return sorted(s.endpoint for s in subs)


async def _age_revocations(session_factory) -> None:
    """Deja las sesiones revocadas como si lo estuvieran desde hace una hora:
    fuera del margen en que una recién revocada todavía cuenta como viva."""
    async with session_factory() as session:
        await session.execute(
            update(RefreshSessionModel)
            .where(RefreshSessionModel.revoked_at.is_not(None))
            .values(revoked_at=datetime.now(UTC) - timedelta(hours=1))
        )
        await session.commit()


async def _add_device(session_factory, user_id: UUID, name: str) -> str:
    endpoint = f"https://fcm.googleapis.com/fcm/send/{name}"
    async with session_factory() as session:
        await SqlAlchemyPushSubscriptionRepository(session).add(
            PushSubscription(
                user_id=user_id, endpoint=endpoint, p256dh_key="clave-p", auth_key="clave-a"
            )
        )
    return endpoint


# --- 1. POST /push/release ----------------------------------------------------


async def test_la_baja_sin_sesion_borra_el_dispositivo_si_coincide_todo(
    client: AsyncClient, session_factory
):
    headers = await auth_headers(client, "worker", "baja_ok@staffya.com")
    user_id = await _me(client, headers)
    await _subscribe(client, headers)

    # Sin Authorization: el token pudo haber vencido antes de cerrar sesión.
    async with new_client() as navegador_sin_sesion:
        response = await _release(navegador_sin_sesion, user_id)

    assert response.status_code == 204
    assert response.content == b""
    assert await _owners(session_factory) == []


@pytest.mark.parametrize(
    "caso",
    ["auth-equivocada", "auth-no-ascii", "cuenta-de-otro", "cuenta-inexistente", "endpoint-inexistente"],
)
async def test_la_baja_que_no_coincide_responde_igual_y_no_borra(
    client: AsyncClient, session_factory, caso: str
):
    """Conocer el endpoint de otra persona (o su id de cuenta) no alcanza
    para cortarle los avisos: hace falta la clave que sólo tiene su
    navegador. Y la respuesta no distingue ningún caso del que sí borra."""
    duenia = await auth_headers(client, "worker", f"baja_duenia_{caso}@staffya.com")
    otra = await auth_headers(client, "employer", f"baja_otra_{caso}@staffya.com")
    duenia_id = await _me(client, duenia)
    otra_id = await _me(client, otra)
    await _subscribe(client, duenia)

    intento = {
        "auth-equivocada": dict(user_id=duenia_id, auth="auth-inventada"),
        "auth-no-ascii": dict(user_id=duenia_id, auth="auth-del-navegadorñ"),
        "cuenta-de-otro": dict(user_id=otra_id),
        "cuenta-inexistente": dict(user_id=uuid4()),
        "endpoint-inexistente": dict(
            user_id=duenia_id, endpoint="https://fcm.googleapis.com/fcm/send/no-existe"
        ),
    }[caso]
    response = await _release(client, **intento)

    assert response.status_code == 204
    assert response.content == b""
    assert await _owners(session_factory) == [duenia_id]


async def test_la_baja_vieja_de_quien_salio_no_borra_el_registro_de_quien_entro(
    client: AsyncClient, session_factory
):
    """Orden de llegada: A cerró sesión sin red (la baja quedó pendiente), B
    entró en ese navegador y lo registró. Cuando la baja de A por fin llega,
    la fila ya es de B y no se toca. Y al revés (la baja llega primero) B
    registra una fila nueva: cualquier orden termina con el dispositivo a
    nombre de B."""
    de_a = await auth_headers(client, "worker", "orden_a@staffya.com")
    de_b = await auth_headers(client, "employer", "orden_b@staffya.com")
    a_id, b_id = await _me(client, de_a), await _me(client, de_b)

    # Registro de B antes que la baja de A.
    await _subscribe(client, de_a)
    await _subscribe(client, de_b)
    assert (await _release(client, a_id)).status_code == 204
    assert await _owners(session_factory) == [b_id]
    # La baja de A repetida (un reintento) tampoco.
    assert (await _release(client, a_id)).status_code == 204
    assert await _owners(session_factory) == [b_id]

    # Baja de A antes que el registro de B.
    otro = "https://fcm.googleapis.com/fcm/send/otro-celular"
    await _subscribe(client, de_a, otro)
    assert (await _release(client, a_id, endpoint=otro)).status_code == 204
    await _subscribe(client, de_b, otro)
    assert await _owners(session_factory, otro) == [b_id]


async def test_si_la_cuenta_se_queda_con_el_dispositivo_entre_la_lectura_y_el_borrado_no_se_le_borra(
    client: AsyncClient, session_factory, monkeypatch
):
    """La carrera adentro del servidor: la baja de A leyó la fila (todavía de
    A) y, antes de borrar, B la registró a su nombre. El borrado va filtrado
    por la cuenta que salió."""
    de_a = await auth_headers(client, "worker", "carrera_a@staffya.com")
    de_b = await auth_headers(client, "employer", "carrera_b@staffya.com")
    a_id, b_id = await _me(client, de_a), await _me(client, de_b)
    await _subscribe(client, de_a)

    original = SqlAlchemyPushSubscriptionRepository.get_by_endpoint

    async def lee_y_despues_entra_b(self, endpoint):
        leida = await original(self, endpoint)
        await _subscribe(client, de_b)
        return leida

    monkeypatch.setattr(
        SqlAlchemyPushSubscriptionRepository, "get_by_endpoint", lee_y_despues_entra_b
    )
    assert (await _release(client, a_id)).status_code == 204
    assert await _owners(session_factory) == [b_id]


async def test_la_baja_sin_sesion_valida_el_endpoint_como_el_alta(client: AsyncClient):
    for endpoint in ("https://atacante.example/push", "http://169.254.169.254/latest"):
        response = await _release(client, uuid4(), endpoint=endpoint)
        assert response.status_code == 422


async def test_un_endpoint_desmedido_se_rechaza_antes_de_llegar_a_la_base(
    client: AsyncClient,
):
    """La ruta no pide sesión: sin tope, un cuerpo de decenas de MB llegaba
    como parámetro de la consulta (revisión independiente)."""
    largo = "https://fcm.googleapis.com/fcm/send/" + "a" * 4000
    assert (await _release(client, uuid4(), endpoint=largo)).status_code == 422
    headers = await auth_headers(client, "worker", "endpoint_largo@staffya.com")
    response = await client.post(
        f"{API}/push/subscribe", json={"endpoint": largo, "keys": CLAVES}, headers=headers
    )
    assert response.status_code == 422


async def test_la_baja_sin_sesion_tiene_limite_por_ip(client: AsyncClient):
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        codes = [(await _release(client, uuid4())).status_code for _ in range(31)]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    assert codes[:30] == [204] * 30 and codes[30] == 429


async def test_el_interruptor_de_ajustes_sigue_pidiendo_sesion(client: AsyncClient):
    response = await client.request("DELETE", SUBSCRIBE, json={"endpoint": ENDPOINT})
    assert response.status_code in (401, 403)


# --- 2. Suspender borra los dispositivos ---------------------------------------


async def test_suspender_borra_todos_los_dispositivos_de_la_cuenta_y_solo_esos(
    client: AsyncClient, session_factory
):
    admin = await make_admin(client, session_factory, "susp_admin@staffya.com")
    suspendida = await auth_headers(client, "employer", "susp_cuenta@staffya.com")
    otra = await auth_headers(client, "employer", "susp_otra@staffya.com")
    susp_id, otra_id = await _me(client, suspendida), await _me(client, otra)
    await _add_device(session_factory, susp_id, "susp-celular")
    await _add_device(session_factory, susp_id, "susp-compu")
    de_la_otra = await _add_device(session_factory, otra_id, "otra-celular")

    assert (await _suspend(client, admin, "susp_cuenta@staffya.com")).status_code == 200

    assert await _devices_of(session_factory, susp_id) == []
    assert await _devices_of(session_factory, otra_id) == [de_la_otra]

    # Reactivar no restaura nada: el dispositivo se registra solo al ingresar.
    user_id = await _user_id(client, admin, "susp_cuenta@staffya.com")
    assert (
        await client.post(f"{API}/admin/users/{user_id}/activate", headers=admin)
    ).status_code == 200
    assert await _devices_of(session_factory, susp_id) == []
    de_vuelta = await login(client, "susp_cuenta@staffya.com")
    await _subscribe(client, {"Authorization": f"Bearer {de_vuelta['access_token']}"})
    assert await _devices_of(session_factory, susp_id) == [ENDPOINT]


async def test_la_cuenta_suspendida_no_puede_volver_a_registrar_el_dispositivo(
    client: AsyncClient, session_factory
):
    """Los dispositivos se borran después de marcar la cuenta: con el access
    token que todavía no venció ya no puede registrar otro."""
    admin = await make_admin(client, session_factory, "susp2_admin@staffya.com")
    suspendida = await auth_headers(client, "worker", "susp2_cuenta@staffya.com")
    susp_id = await _me(client, suspendida)
    await _subscribe(client, suspendida)
    assert (await _suspend(client, admin, "susp2_cuenta@staffya.com")).status_code == 200

    intento = await client.post(
        SUBSCRIBE, json={"endpoint": ENDPOINT, "keys": CLAVES}, headers=suspendida
    )

    assert intento.status_code in (401, 403)
    assert await _devices_of(session_factory, susp_id) == []


async def test_si_falla_el_borrado_de_dispositivos_la_cuenta_se_suspende_igual(
    client: AsyncClient, session_factory, monkeypatch
):
    admin = await make_admin(client, session_factory, "susp3_admin@staffya.com")
    cuenta = await auth_headers(client, "employer", "susp3_cuenta@staffya.com")
    cuenta_id = await _me(client, cuenta)
    quedo = await _add_device(session_factory, cuenta_id, "susp3-celular")

    async def se_cae(self, user_id):
        raise RuntimeError("la base se cortó al borrar los dispositivos")

    monkeypatch.setattr(_PushDeviceRemover, "remove_for_user", se_cae)
    response = await _suspend(client, admin, "susp3_cuenta@staffya.com")

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    # La sesión quedó cortada de todos modos.
    assert (await client.get(f"{API}/auth/me", headers=cuenta)).status_code in (401, 403)
    # El dispositivo quedó. Lo levanta el barrido: suspender revocó todas sus
    # sesiones, así que pasado el margen la cuenta no tiene ninguna viva.
    assert await _devices_of(session_factory, cuenta_id) == [quedo]
    await _age_revocations(session_factory)
    assert await sweep_devices_of_revoked_accounts(session_factory) == 1
    assert await _devices_of(session_factory, cuenta_id) == []


async def test_al_suspender_los_dispositivos_se_borran_despues_de_la_segunda_pasada(
    client: AsyncClient, session_factory, monkeypatch
):
    """Comparten la sesión de la base: si el borrado fallara antes, la segunda
    pasada de efectos (ADR-0024, punto 9) no podría correr."""
    from app.modules.shift.application.services import ShiftService

    admin = await make_admin(client, session_factory, "susp4_admin@staffya.com")
    await auth_headers(client, "employer", "susp4_cuenta@staffya.com")
    orden: list[str] = []
    efectos = ShiftService.apply_account_suspension
    borrar = _PushDeviceRemover.remove_for_user

    async def pasada(self, user_id):
        orden.append("efectos")
        return await efectos(self, user_id)

    async def dispositivos(self, user_id):
        orden.append("dispositivos")
        return await borrar(self, user_id)

    monkeypatch.setattr(ShiftService, "apply_account_suspension", pasada)
    monkeypatch.setattr(_PushDeviceRemover, "remove_for_user", dispositivos)
    response = await _suspend(client, admin, "susp4_cuenta@staffya.com")

    assert response.status_code == 200
    assert orden == ["efectos", "efectos", "dispositivos"]


# --- 3. Barrido: cuentas que se quedaron sin sesión por una revocación ----------


async def _user_without_session(client: AsyncClient, session_factory, email: str) -> UUID:
    """El registro no abre sesión: la cuenta no tiene filas en `refresh_sessions`."""
    await register_user(client, email=email)
    async with session_factory() as session:
        return (await SqlAlchemyUserRepository(session).get_by_email(email)).id


async def _add_session(
    session_factory,
    user_id: UUID,
    *,
    created_ago: timedelta,
    expires_in: timedelta,
    revoked_ago: timedelta | None = None,
) -> None:
    now = datetime.now(UTC)
    async with session_factory() as session:
        session.add(
            RefreshSessionModel(
                id=uuid4(),
                user_id=user_id,
                jti=str(uuid4()),
                created_at=now - created_ago,
                expires_at=now + expires_in,
                revoked_at=None if revoked_ago is None else now - revoked_ago,
            )
        )
        await session.commit()


def _dias(n: float) -> timedelta:
    return timedelta(days=n)


# Cada sesión: cuándo se creó, cuándo vence (negativo = ya venció) y, si la
# revocaron, hace cuánto.
_VENCIO_SOLA = dict(created_ago=_dias(40), expires_in=_dias(-10))
_VIVA = dict(created_ago=_dias(2), expires_in=_dias(28))


@pytest.mark.parametrize(
    ("sesiones", "se_borra"),
    [
        # No abre la app hace más de un mes: la sesión venció sola.
        ([_VENCIO_SOLA], False),
        # La retención ya le limpió las filas: no se sabe cómo terminó.
        ([], False),
        # Cerró sesión (o restableció la contraseña, o se reutilizó un
        # refresh): todo lo que tenía quedó revocado.
        ([dict(created_ago=_dias(5), expires_in=_dias(25), revoked_ago=timedelta(hours=2))], True),
        (
            [
                dict(created_ago=_dias(9), expires_in=_dias(21), revoked_ago=_dias(5)),
                dict(created_ago=_dias(5), expires_in=_dias(25), revoked_ago=timedelta(hours=2)),
            ],
            True,
        ),
        # Revocada y además ya vencida (todavía no la limpió la retención).
        ([dict(created_ago=_dias(33), expires_in=_dias(-3), revoked_ago=_dias(20))], True),
        # Rotación normal: la anterior quedó revocada y la nueva está viva.
        (
            [
                dict(created_ago=_dias(5), expires_in=_dias(25), revoked_ago=_dias(2)),
                _VIVA,
            ],
            False,
        ),
        # Renovó y después dejó vencer la nueva sin usarla: inactiva.
        (
            [
                dict(created_ago=_dias(50), expires_in=_dias(-20), revoked_ago=_dias(40)),
                _VENCIO_SOLA,
            ],
            False,
        ),
        # Cerró sesión en el celular (la última) y en la compu se le había
        # vencido sola una más vieja: lo último que hizo fue cerrar.
        (
            [
                _VENCIO_SOLA,
                dict(created_ago=_dias(5), expires_in=_dias(25), revoked_ago=_dias(1)),
            ],
            True,
        ),
        # Cerró sesión en un dispositivo pero sigue con otra sesión viva.
        (
            [
                _VIVA,
                dict(created_ago=_dias(1), expires_in=_dias(29), revoked_ago=timedelta(hours=2)),
            ],
            False,
        ),
        # Recién revocada: es la que se acaba de rotar, o todavía hay un
        # access token suyo dando vueltas.
        ([dict(created_ago=_dias(5), expires_in=_dias(25), revoked_ago=timedelta(seconds=30))], False),
        # ...pero si además ya venció, ese access token también.
        ([dict(created_ago=_dias(33), expires_in=_dias(-3), revoked_ago=timedelta(seconds=30))], True),
    ],
    ids=[
        "inactiva-vencio-sola",
        "sin-ninguna-fila",
        "todas-revocadas-una",
        "todas-revocadas-varias",
        "revocada-y-vencida",
        "rotacion-normal",
        "renovo-y-dejo-vencer",
        "cerro-la-ultima-y-otra-vencio-sola",
        "cerro-una-y-sigue-con-otra-viva",
        "recien-revocada",
        "recien-revocada-pero-vencida",
    ],
)
async def test_a_que_cuentas_les_borra_los_dispositivos_el_barrido(
    client: AsyncClient, session_factory, sesiones: list[dict], se_borra: bool
):
    """Sólo si la cuenta se quedó sin sesión por una revocación: ninguna
    viva, alguna fila, y la más reciente revocada. La que no abre la app hace
    un mes conserva el dispositivo: el aviso de un turno cerca es lo que la
    trae de vuelta, y `/privacidad` no promete borrar por inactividad."""
    user_id = await _user_without_session(client, session_factory, "barrido_caso@staffya.com")
    for sesion in sesiones:
        await _add_session(session_factory, user_id, **sesion)
    endpoints = sorted(
        [
            await _add_device(session_factory, user_id, "celular-del-caso"),
            await _add_device(session_factory, user_id, "compu-del-caso"),
        ]
    )

    borrados = await sweep_devices_of_revoked_accounts(session_factory)

    assert borrados == (2 if se_borra else 0)
    assert await _devices_of(session_factory, user_id) == ([] if se_borra else endpoints)
    # Repetirlo no cambia nada.
    assert await sweep_devices_of_revoked_accounts(session_factory) == 0


async def test_si_dos_sesiones_empatan_como_la_mas_reciente_alcanza_una_sin_revocar_para_no_borrar(
    client: AsyncClient, session_factory
):
    user_id = await _user_without_session(client, session_factory, "barrido_empate@staffya.com")
    mismo_instante = datetime.now(UTC) - _dias(40)
    async with session_factory() as session:
        for revocada in (mismo_instante + _dias(20), None):
            session.add(
                RefreshSessionModel(
                    id=uuid4(),
                    user_id=user_id,
                    jti=str(uuid4()),
                    created_at=mismo_instante,
                    expires_at=mismo_instante + _dias(30),
                    revoked_at=revocada,
                )
            )
        await session.commit()
    endpoint = await _add_device(session_factory, user_id, "celular-del-empate")

    assert await sweep_devices_of_revoked_accounts(session_factory) == 0
    assert await _devices_of(session_factory, user_id) == [endpoint]


async def test_el_barrido_no_toca_a_las_demas_cuentas(client: AsyncClient, session_factory):
    cerro = await _user_without_session(client, session_factory, "barrido_cerro@staffya.com")
    await _add_session(
        session_factory, cerro, created_ago=_dias(3), expires_in=_dias(27), revoked_ago=_dias(1)
    )
    inactiva = await _user_without_session(client, session_factory, "barrido_inactiva@staffya.com")
    await _add_session(session_factory, inactiva, **_VENCIO_SOLA)
    con_sesion = await auth_headers(client, "worker", "barrido_con@staffya.com")
    con_sesion_id = await _me(client, con_sesion)
    await _add_device(session_factory, cerro, "cerro-celular")
    de_la_inactiva = await _add_device(session_factory, inactiva, "inactiva-celular")
    de_la_activa = await _add_device(session_factory, con_sesion_id, "con-sesion-celular")

    assert await sweep_devices_of_revoked_accounts(session_factory) == 1

    assert await _devices_of(session_factory, cerro) == []
    assert await _devices_of(session_factory, inactiva) == [de_la_inactiva]
    assert await _devices_of(session_factory, con_sesion_id) == [de_la_activa]


async def test_cerrar_sesion_deja_a_la_cuenta_para_el_barrido_pasado_el_margen(
    client: AsyncClient, session_factory
):
    """Con el recorrido real: ingreso, y un cierre de sesión cuya baja del
    navegador nunca llegó (el dispositivo quedó registrado)."""
    headers = await auth_headers(client, "worker", "barrido_revocada@staffya.com")
    user_id = await _me(client, headers)
    await _subscribe(client, headers)
    assert (await client.post(f"{API}/auth/logout")).status_code == 204

    # Recién revocada: todavía puede haber un access token suyo dando vueltas.
    assert await sweep_devices_of_revoked_accounts(session_factory) == 0
    await _age_revocations(session_factory)

    assert await sweep_devices_of_revoked_accounts(session_factory) == 1
    assert await _devices_of(session_factory, user_id) == []


async def test_restablecer_la_contrasenia_deja_a_la_cuenta_para_el_barrido(
    client: AsyncClient, session_factory
):
    """Quien restablece la contraseña corta todas sus sesiones a propósito:
    el navegador donde quedó la sesión vieja no avisa nada."""
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        headers = await auth_headers(client, "worker", "barrido_clave@staffya.com")
        user_id = await _me(client, headers)
        await _subscribe(client, headers)
        pedido = await client.post(
            f"{API}/auth/forgot-password", json={"email": "barrido_clave@staffya.com"}
        )
        assert pedido.status_code == 202
        cambio = await client.post(
            f"{API}/auth/reset-password",
            json={"token": _extract_token(fake.sent[-1].html), "new_password": CLAVE_NUEVA},
        )
        assert cambio.status_code == 204
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
    await _age_revocations(session_factory)

    assert await sweep_devices_of_revoked_accounts(session_factory) == 1
    assert await _devices_of(session_factory, user_id) == []


async def test_un_refresh_reutilizado_deja_a_la_cuenta_para_el_barrido(
    client: AsyncClient, session_factory
):
    """Reusar un refresh ya rotado se toma como robo: el servidor revoca
    todas las sesiones de la cuenta, también la que estaba viva."""
    headers = await auth_headers(client, "worker", "barrido_reuso@staffya.com")
    user_id = await _me(client, headers)
    await _subscribe(client, headers)
    viejo = client.cookies.get("staffya_refresh")
    assert (await client.post(f"{API}/auth/refresh")).status_code == 200
    # Rotó: la anterior está revocada y la nueva viva. No se borra nada.
    await _age_revocations(session_factory)
    assert await sweep_devices_of_revoked_accounts(session_factory) == 0

    assert (await refresh_with_cookie(viejo)).status_code == 401
    await _age_revocations(session_factory)

    assert await sweep_devices_of_revoked_accounts(session_factory) == 1
    assert await _devices_of(session_factory, user_id) == []


class _GoogleDePrueba(GoogleTokenVerifier):
    async def verify(self, id_token: str) -> GoogleIdentity:
        return GoogleIdentity(
            email="barrido_google@gmail.com", email_verified=True, full_name="Con Google"
        )


async def _entra_con_contrasenia(client: AsyncClient, session_factory) -> dict:
    return await auth_headers(client, "worker", "barrido_login@staffya.com")


async def _entra_con_google(client: AsyncClient, session_factory) -> dict:
    app.dependency_overrides[get_google_verifier] = lambda: _GoogleDePrueba()
    try:
        response = await client.post(
            f"{API}/auth/google",
            json={
                "id_token": "tok",
                "role": "worker",
                "accepted_terms": True,
                "birth_date": "1995-05-20",
            },
        )
    finally:
        app.dependency_overrides.pop(get_google_verifier, None)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _entra_como_invitada(client: AsyncClient, session_factory) -> dict:
    response = await client.post(
        f"{API}/auth/guest", json={"pin": TEST_GUEST_PIN, "role": "worker"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _entra_con_codigo_de_admin(client: AsyncClient, session_factory) -> dict:
    """Admin con la verificación activa: contraseña, desafío y código."""
    email = "barrido_admin@staffya.com"
    alta = await enroll_admin(client, session_factory, email)
    # Sale de todos lados y vuelve a entrar por el paso del código.
    assert (await client.post(f"{API}/auth/logout")).status_code == 204
    desafio = (await login(client, email))["challenge_token"]
    verificado = await client.post(
        f"{API}/auth/2fa/verify",
        json={"challenge_token": desafio, "code": current_totp(alta["secret"], steps_ahead=1)},
    )
    assert verificado.status_code == 200, verificado.text
    return {"Authorization": f"Bearer {verificado.json()['access_token']}"}


async def _entra_y_renueva(client: AsyncClient, session_factory) -> dict:
    """La sesión abierta hace rato: el refresh rotó (la fila vieja quedó
    revocada y hay una nueva)."""
    await auth_headers(client, "worker", "barrido_renueva@staffya.com")
    renovado = await client.post(f"{API}/auth/refresh")
    assert renovado.status_code == 200, renovado.text
    return {"Authorization": f"Bearer {renovado.json()['access_token']}"}


@pytest.mark.parametrize(
    "ingreso",
    [
        _entra_con_contrasenia,
        _entra_con_google,
        _entra_como_invitada,
        _entra_con_codigo_de_admin,
        _entra_y_renueva,
    ],
    ids=["contrasenia", "google", "invitada", "codigo-de-admin", "sesion-renovada"],
)
async def test_ningun_ingreso_deja_una_sesion_abierta_sin_fila_viva(
    client: AsyncClient, session_factory, ingreso
):
    """El barrido le borraría el dispositivo a alguien con la sesión abierta
    si algún camino de ingreso no guardara su sesión de refresh. Todos pasan
    por `IdentityService._issue_tokens`; esto lo fija."""
    headers = await ingreso(client, session_factory)
    user_id = await _me(client, headers)
    await _subscribe(client, headers)
    # Ni siquiera con las revocadas ya fuera del margen.
    await _age_revocations(session_factory)

    assert await sweep_devices_of_revoked_accounts(session_factory) == 0
    assert await _devices_of(session_factory, user_id) == [ENDPOINT]


async def test_ver_como_no_cuenta_como_sesion_de_la_persona_vista(
    client: AsyncClient, session_factory
):
    """«Ver como» da un access token de la persona vista SIN sesión de
    refresh. No es una sesión de esa persona en ningún dispositivo (el
    frontend no registra nada mientras se impersona): el barrido decide por
    las sesiones propias de cada cuenta, y no toca a la admin."""
    admin = await make_admin(client, session_factory, "barrido_vercomo_admin@staffya.com")
    admin_id = await _me(client, admin)
    del_admin = await _add_device(session_factory, admin_id, "compu-de-la-admin")
    # La persona vista cerró sesión hace días y su baja nunca llegó.
    vista = await _user_without_session(client, session_factory, "barrido_vista@staffya.com")
    await _add_session(
        session_factory, vista, created_ago=_dias(6), expires_in=_dias(24), revoked_ago=_dias(4)
    )
    await _add_device(session_factory, vista, "celular-viejo-de-la-vista")

    viendo = await client.post(f"{API}/admin/users/{vista}/impersonate", headers=admin)
    assert viendo.status_code == 200, viendo.text
    async with session_factory() as session:
        filas = await session.execute(
            select(RefreshSessionModel.revoked_at).where(RefreshSessionModel.user_id == vista)
        )
        # Impersonar no le creó ninguna sesión: sigue con la suya, revocada.
        assert [revocada is not None for revocada in filas.scalars().all()] == [True]
    await _age_revocations(session_factory)

    assert await sweep_devices_of_revoked_accounts(session_factory) == 1

    assert await _devices_of(session_factory, admin_id) == [del_admin]
    assert await _devices_of(session_factory, vista) == []


async def test_el_barrido_corre_en_la_pasada_de_retencion(
    client: AsyncClient, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(scheduler, "_last_retention_run", None)
    cerro = await _user_without_session(client, session_factory, "barrido_pasada@staffya.com")
    await _add_session(
        session_factory, cerro, created_ago=_dias(3), expires_in=_dias(27), revoked_ago=_dias(1)
    )
    await _add_device(session_factory, cerro, "pasada-celular")

    async def barrido() -> int:
        return await sweep_devices_of_revoked_accounts(session_factory)

    assert await scheduler.run_retention_cleanup(extra_steps=(barrido,)) is None
    assert await _devices_of(session_factory, cerro) == []

    # Como mucho una vez por día, igual que el resto de la retención.
    await _add_device(session_factory, cerro, "pasada-celular-2")
    await scheduler.run_retention_cleanup(extra_steps=(barrido,))
    assert len(await _devices_of(session_factory, cerro)) == 1


async def test_el_barrido_ve_la_sesion_revocada_que_esa_misma_pasada_va_a_limpiar(
    client: AsyncClient, session_factory, monkeypatch
):
    """La retención borra las sesiones vencidas hace más de 7 días, revocadas
    o no. Una revocada que ya cumplió ese plazo es lo único que dice que la
    cuenta cerró: el barrido corre ANTES de ese borrado."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(scheduler, "_last_retention_run", None)
    cerro = await _user_without_session(client, session_factory, "barrido_orden@staffya.com")
    await _add_session(
        session_factory, cerro, created_ago=_dias(38), expires_in=_dias(-8), revoked_ago=_dias(1)
    )
    await _add_device(session_factory, cerro, "orden-celular")

    async def barrido() -> int:
        return await sweep_devices_of_revoked_accounts(session_factory)

    await scheduler.run_retention_cleanup(extra_steps=(barrido,))

    assert await _devices_of(session_factory, cerro) == []
    async with session_factory() as session:
        filas = await session.execute(
            select(RefreshSessionModel.id).where(RefreshSessionModel.user_id == cerro)
        )
        assert filas.scalars().all() == []
    # Ya sin filas, el barrido siguiente no tiene con qué decidir: no borra.
    quedo = await _add_device(session_factory, cerro, "orden-celular-2")
    assert await barrido() == 0
    assert await _devices_of(session_factory, cerro) == [quedo]


async def test_un_paso_de_retencion_que_falla_no_corta_la_pasada_ni_se_repite_enseguida(
    client: AsyncClient, session_factory, monkeypatch, caplog
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(scheduler, "_last_retention_run", None)
    corridas: list[str] = []

    async def roto() -> int:
        corridas.append("roto")
        raise RuntimeError("la base se cortó")

    async def sano() -> int:
        corridas.append("sano")
        return 0

    assert await scheduler.run_retention_cleanup(extra_steps=(roto, sano)) is None
    assert corridas == ["roto", "sano"]
    assert "Error en el paso de retención roto" in caplog.text

    # La pasada quedó hecha: no reintenta cada pocos minutos (cuota de Neon).
    await scheduler.run_retention_cleanup(extra_steps=(roto, sano))
    assert corridas == ["roto", "sano"]


async def test_main_le_pasa_el_barrido_al_scheduler():
    """El scheduler no importa el módulo de notificaciones para esto: el paso
    entra desde `app/main.py`."""
    import inspect

    import app.main as main
    from app.modules.notification.infrastructure.device_sweep_job import run_device_sweep

    assert main.run_device_sweep is run_device_sweep
    assert "retention_steps=(run_device_sweep,)" in inspect.getsource(main)
