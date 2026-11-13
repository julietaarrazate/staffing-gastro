"""El chat es del comercio con UNA persona asignada: un hilo por (turno, trabajador).

Cuando un turno se reasigna (rechazo, baja del trabajador o ausencia), quien lo
recibe arranca con la conversación vacía; el comercio ve sólo el hilo con la
persona asignada ahora; la anterior deja de tener acceso. Los mensajes del hilo
anterior siguen guardados, pero no se le muestran a nadie que no fue parte.

Todo lo que deriva del hilo respeta el mismo corte: bandeja, último mensaje, no
leídos, marcar como leído, avisos y el WebSocket.
"""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.modules.chat.infrastructure.models import ChatMessageModel
from tests._turno_empezado import empezar_turno
from tests.conftest import auth_headers
from tests.test_chat import _setup_in_memory_db

SHIFT = {
    "position": "mozo",
    "quantity": 1,
    "start_at": "2026-06-28T20:00:00",
    "end_at": "2026-06-29T03:00:00",
    "pay_amount": "70000.00",
    "city": "Palermo",
}

# Las tres transiciones que le sacan el turno a quien lo tenía y lo reabren.
CAMINOS = ("rechazo", "baja", "ausencia")


@dataclass
class Persona:
    headers: dict
    user_id: str
    profile_id: str


@dataclass
class Escenario:
    shift_id: str
    comercio: dict
    comercio_user_id: str
    anterior: Persona
    nueva: Persona


async def _user_id(client: AsyncClient, headers: dict) -> str:
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    return me.json()["id"]


async def _comercio(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email, "Bar de Prueba")
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar de Prueba", "city": "Palermo"},
    )
    return headers


async def _trabajador(client: AsyncClient, email: str, nombre: str) -> Persona:
    headers = await auth_headers(client, "worker", email, nombre)
    profile = await client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    )
    return Persona(
        headers=headers,
        user_id=await _user_id(client, headers),
        profile_id=profile.json()["id"],
    )


async def _turno_publicado(client: AsyncClient, comercio: dict) -> str:
    created = await client.post("/api/v1/shifts", headers=comercio, json=SHIFT)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    return shift_id


async def _asignar(client: AsyncClient, comercio: dict, shift_id: str, persona: Persona):
    assigned = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=comercio,
        json={"worker_profile_id": persona.profile_id},
    )
    assert assigned.status_code == 200


_FABRICA: dict = {}


@pytest.fixture(autouse=True)
def _guardar_fabrica_de_sesiones(session_factory):
    """«No se presentó» exige que el turno haya empezado: el helper necesita la base."""
    _FABRICA["sesiones"] = session_factory


async def _desasignar(
    client: AsyncClient, camino: str, shift_id: str, comercio: dict, persona: Persona
):
    """Le saca el turno a `persona` por uno de los tres caminos que lo reabren."""
    if camino == "rechazo":
        response = await client.post(
            f"/api/v1/shifts/{shift_id}/reject", headers=persona.headers
        )
    else:
        confirmed = await client.post(
            f"/api/v1/shifts/{shift_id}/confirm", headers=persona.headers
        )
        assert confirmed.status_code == 200
        if camino == "baja":
            response = await client.post(
                f"/api/v1/shifts/{shift_id}/worker-cancel", headers=persona.headers
            )
        else:
            await empezar_turno(_FABRICA["sesiones"], shift_id)
            response = await client.post(
                f"/api/v1/shifts/{shift_id}/no-show", headers=comercio
            )
    assert response.status_code == 200


async def _enviar(client: AsyncClient, headers: dict, shift_id: str, body: str):
    sent = await client.post(
        f"/api/v1/chats/{shift_id}/messages", headers=headers, json={"body": body}
    )
    assert sent.status_code == 201


async def _cuerpos(client: AsyncClient, headers: dict, shift_id: str) -> list[str]:
    """Abre la conversación (lo que además marca como leído lo recibido)."""
    response = await client.get(f"/api/v1/chats/{shift_id}/messages", headers=headers)
    assert response.status_code == 200
    return [m["body"] for m in response.json()]


async def _bandeja(client: AsyncClient, headers: dict) -> list[dict]:
    response = await client.get("/api/v1/chats", headers=headers)
    assert response.status_code == 200
    return response.json()


async def _avisos_de_chat(client: AsyncClient, headers: dict) -> list[dict]:
    response = await client.get("/api/v1/notifications", headers=headers)
    return [n for n in response.json() if n["type"] == "chat_message"]


async def _turno_reasignado(
    client: AsyncClient, sufijo: str, camino: str = "rechazo"
) -> Escenario:
    """Un turno donde el comercio y la primera persona se escribieron (un
    mensaje de cada lado, ninguno leído por el otro), y que después se reasignó
    a una segunda persona."""
    comercio = await _comercio(client, f"hilos_emp_{sufijo}@staffya.com")
    anterior = await _trabajador(client, f"hilos_w1_{sufijo}@staffya.com", "Primera Persona")
    nueva = await _trabajador(client, f"hilos_w2_{sufijo}@staffya.com", "Segunda Persona")
    shift_id = await _turno_publicado(client, comercio)

    await _asignar(client, comercio, shift_id, anterior)
    await _enviar(client, comercio, shift_id, "comercio a la primera persona")
    await _enviar(client, anterior.headers, shift_id, "la primera persona al comercio")

    await _desasignar(client, camino, shift_id, comercio, anterior)
    await _asignar(client, comercio, shift_id, nueva)
    return Escenario(
        shift_id=shift_id,
        comercio=comercio,
        comercio_user_id=await _user_id(client, comercio),
        anterior=anterior,
        nueva=nueva,
    )


@pytest.mark.parametrize("camino", CAMINOS)
async def test_quien_recibe_un_turno_reasignado_arranca_con_el_hilo_vacio(
    client: AsyncClient, camino: str
):
    e = await _turno_reasignado(client, camino, camino)

    # La persona nueva: conversación vacía y nada en su lista.
    assert await _cuerpos(client, e.nueva.headers, e.shift_id) == []
    assert await _bandeja(client, e.nueva.headers) == []

    # El comercio: en el chat de ese turno ve el hilo con la persona asignada
    # ahora, que todavía no tiene mensajes (y por eso no figura en su lista).
    assert await _cuerpos(client, e.comercio, e.shift_id) == []
    assert await _bandeja(client, e.comercio) == []

    # La persona anterior ya no participa: ni lee ni escribe (no-disclosure).
    leer = await client.get(
        f"/api/v1/chats/{e.shift_id}/messages", headers=e.anterior.headers
    )
    assert leer.status_code == 404
    escribir = await client.post(
        f"/api/v1/chats/{e.shift_id}/messages",
        headers=e.anterior.headers,
        json={"body": "sigo acá"},
    )
    assert escribir.status_code == 404
    assert await _bandeja(client, e.anterior.headers) == []


async def test_el_comercio_ve_solo_el_hilo_con_la_persona_asignada_ahora(
    client: AsyncClient,
):
    e = await _turno_reasignado(client, "solo_actual")

    await _enviar(client, e.comercio, e.shift_id, "comercio a la segunda persona")
    await _enviar(client, e.nueva.headers, e.shift_id, "la segunda persona al comercio")

    hilo_actual = ["comercio a la segunda persona", "la segunda persona al comercio"]
    assert await _cuerpos(client, e.comercio, e.shift_id) == hilo_actual
    assert await _cuerpos(client, e.nueva.headers, e.shift_id) == hilo_actual

    # (Los dos mensajes del hilo salen en el mismo segundo y SQLite no guarda
    # fracciones: cuál de los dos es "el último" no está definido en el test.)
    [tarjeta] = await _bandeja(client, e.comercio)
    assert tarjeta["shift_id"] == e.shift_id
    assert tarjeta["other_party_name"] == "Segunda Persona"
    assert tarjeta["last_message"] in hilo_actual


async def test_no_leidos_y_ultimo_mensaje_son_los_del_hilo(client: AsyncClient):
    """El hilo anterior quedó con un mensaje sin leer de cada lado: no cuentan
    ni se muestran como vista previa en la conversación con la persona nueva."""
    e = await _turno_reasignado(client, "contadores")

    await _enviar(client, e.comercio, e.shift_id, "comercio a la segunda persona")

    [tarjeta_nueva] = await _bandeja(client, e.nueva.headers)
    assert tarjeta_nueva["other_party_name"] == "Bar de Prueba"
    assert tarjeta_nueva["last_message"] == "comercio a la segunda persona"
    assert tarjeta_nueva["unread_count"] == 1

    [tarjeta_comercio] = await _bandeja(client, e.comercio)
    assert tarjeta_comercio["last_message"] == "comercio a la segunda persona"
    assert tarjeta_comercio["unread_count"] == 0


async def test_marcar_leido_no_toca_mensajes_de_otro_hilo(
    client: AsyncClient, session_factory
):
    e = await _turno_reasignado(client, "leidos")
    await _enviar(client, e.comercio, e.shift_id, "comercio a la segunda persona")

    # Las dos partes del hilo actual abren la conversación.
    await _cuerpos(client, e.nueva.headers, e.shift_id)
    await _cuerpos(client, e.comercio, e.shift_id)

    async with session_factory() as session:
        result = await session.execute(
            select(ChatMessageModel).order_by(ChatMessageModel.created_at)
        )
        guardados = {m.body: m for m in result.scalars().all()}

    # Los mensajes del hilo anterior no se borran, siguen atados a la persona
    # con la que se habló y nadie los marcó como leídos al abrir el hilo nuevo.
    for body in ("comercio a la primera persona", "la primera persona al comercio"):
        assert str(guardados[body].worker_user_id) == e.anterior.user_id
        assert guardados[body].read is False
    actual = guardados["comercio a la segunda persona"]
    assert str(actual.worker_user_id) == e.nueva.user_id
    assert actual.read is True


async def test_volver_a_asignar_a_la_misma_persona_retoma_su_propio_hilo(
    client: AsyncClient,
):
    e = await _turno_reasignado(client, "retoma")
    await _enviar(client, e.comercio, e.shift_id, "comercio a la segunda persona")
    await _desasignar(client, "rechazo", e.shift_id, e.comercio, e.nueva)
    await _asignar(client, e.comercio, e.shift_id, e.anterior)

    # Vuelve a ver lo que se escribió con el comercio (fue parte), con su
    # pendiente de lectura intacto, y nada del hilo de la otra persona.
    su_hilo = ["comercio a la primera persona", "la primera persona al comercio"]
    [tarjeta] = await _bandeja(client, e.anterior.headers)
    assert tarjeta["last_message"] in su_hilo
    assert tarjeta["unread_count"] == 1
    assert await _cuerpos(client, e.anterior.headers, e.shift_id) == su_hilo

    [tarjeta_comercio] = await _bandeja(client, e.comercio)
    assert tarjeta_comercio["other_party_name"] == "Primera Persona"
    assert tarjeta_comercio["last_message"] in su_hilo
    assert tarjeta_comercio["unread_count"] == 1

    sin_acceso = await client.get(
        f"/api/v1/chats/{e.shift_id}/messages", headers=e.nueva.headers
    )
    assert sin_acceso.status_code == 404


async def test_el_aviso_de_mensaje_nuevo_llega_solo_a_la_persona_del_hilo(
    client: AsyncClient,
):
    e = await _turno_reasignado(client, "avisos")
    antes = await _avisos_de_chat(client, e.anterior.headers)

    await _enviar(client, e.comercio, e.shift_id, "comercio a la segunda persona")

    assert len(await _avisos_de_chat(client, e.nueva.headers)) == 1
    assert await _avisos_de_chat(client, e.anterior.headers) == antes


# --- WebSocket ---------------------------------------------------------------


def _registrar(client: TestClient, email: str, nombre: str, role: str) -> tuple[str, dict]:
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "supersecreta123",
            "full_name": nombre,
            "role": role,
            "accepted_terms": True,
        },
    )
    assert registered.status_code == 201
    token = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "supersecreta123"}
    ).json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


def _perfil_trabajador(client: TestClient, headers: dict) -> str:
    return client.post(
        "/api/v1/workers/me/profile", headers=headers, json={"skills": ["mozo"]}
    ).json()["id"]


def test_una_conexion_abierta_sobre_el_hilo_anterior_no_recibe_el_hilo_nuevo():
    """Quien tenía el chat abierto en vivo y deja de estar asignado no recibe
    lo que el comercio le escribe a la persona nueva: su conexión se corta y
    no puede volver a abrirla. La del comercio, abierta sobre el hilo anterior,
    también se corta en vez de mezclar los dos hilos: al reconectar queda sobre
    el hilo con la persona asignada ahora."""
    _setup_in_memory_db()

    try:
        with TestClient(app) as client:
            token_comercio, comercio = _registrar(
                client, "ws_hilos_emp@staffya.com", "Bar WS", "employer"
            )
            client.post(
                "/api/v1/companies/me/profile",
                headers=comercio,
                json={"name": "Bar WS", "city": "Palermo"},
            )
            token_anterior, anterior = _registrar(
                client, "ws_hilos_w1@staffya.com", "Primera Persona", "worker"
            )
            perfil_anterior = _perfil_trabajador(client, anterior)
            token_nueva, nueva = _registrar(
                client, "ws_hilos_w2@staffya.com", "Segunda Persona", "worker"
            )
            perfil_nueva = _perfil_trabajador(client, nueva)

            shift_id = client.post("/api/v1/shifts", headers=comercio, json=SHIFT).json()["id"]
            client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
            client.post(
                f"/api/v1/shifts/{shift_id}/assign",
                headers=comercio,
                json={"worker_profile_id": perfil_anterior},
            )
            ws_url = f"/api/v1/chats/{shift_id}/ws"

            def enviar(headers: dict, body: str) -> None:
                sent = client.post(
                    f"/api/v1/chats/{shift_id}/messages", headers=headers, json={"body": body}
                )
                assert sent.status_code == 201

            with (
                client.websocket_connect(f"{ws_url}?token={token_anterior}") as ws_anterior,
                client.websocket_connect(f"{ws_url}?token={token_comercio}") as ws_comercio,
            ):
                enviar(comercio, "comercio a la primera persona")
                assert ws_anterior.receive_json()["body"] == "comercio a la primera persona"
                assert ws_comercio.receive_json()["body"] == "comercio a la primera persona"

                rechazo = client.post(f"/api/v1/shifts/{shift_id}/reject", headers=anterior)
                assert rechazo.status_code == 200
                client.post(
                    f"/api/v1/shifts/{shift_id}/assign",
                    headers=comercio,
                    json={"worker_profile_id": perfil_nueva},
                )

                with client.websocket_connect(f"{ws_url}?token={token_nueva}") as ws_nueva:
                    enviar(comercio, "comercio a la segunda persona")
                    assert ws_nueva.receive_json()["body"] == "comercio a la segunda persona"

                    # A las conexiones abiertas sobre el hilo anterior no les
                    # llega el mensaje: lo único que reciben es el cierre.
                    with pytest.raises(WebSocketDisconnect):
                        ws_anterior.receive_json()
                    with pytest.raises(WebSocketDisconnect):
                        ws_comercio.receive_json()

                    # El comercio reconecta (su cliente lo hace solo) y sigue
                    # en vivo, ya sobre el hilo con la persona nueva.
                    with client.websocket_connect(
                        f"{ws_url}?token={token_comercio}"
                    ) as ws_comercio_reconectado:
                        enviar(nueva, "la segunda persona al comercio")
                        recibido = ws_comercio_reconectado.receive_json()
                        assert recibido["body"] == "la segunda persona al comercio"
                        assert ws_nueva.receive_json()["body"] == "la segunda persona al comercio"

            # Quien ya no está asignado no puede volver a conectarse.
            with pytest.raises(WebSocketDisconnect):
                with client.websocket_connect(f"{ws_url}?token={token_anterior}"):
                    pass
    finally:
        app.dependency_overrides.clear()
