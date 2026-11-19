"""PRI-04 (pasada 2026-11-19): un socket autoriza sólo al conectarse.

Antes, un socket de avisos (o de chat) abierto siguió entregando lo de la
cuenta después de que venció el token con el que se conectó, o de que se
revocaran las sesiones (contraseña nueva, reclamo por Google, alta de dos
pasos). Ahora se corta (1008) al vencer el token y al revocar en bloque; el
cliente reconecta con el token renovado."""

import re
import time
from datetime import timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from starlette.websockets import WebSocketDisconnect

from app.core.security import ACCESS_TOKEN, _create_token
from app.core.ws_manager import ConnectionManager, ws_manager
from app.main import app
from app.modules.identity.api.dependencies import get_google_verifier
from app.modules.identity.domain.google_verifier import GoogleIdentity
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from tests.conftest import make_admin, register_user
from tests.test_chat import _setup_assigned_shift_sync, _setup_in_memory_db
from tests.test_ws_manager import FakeWebSocket

# --- el token vence ------------------------------------------------------------


def _esperar_corte(ws) -> int:
    """El servidor cortó: el próximo `receive` tira la desconexión, con su código."""
    with pytest.raises(WebSocketDisconnect) as corte:
        ws.receive_json()
    return corte.value.code


def test_el_socket_de_avisos_se_corta_cuando_vence_el_token():
    from fastapi.testclient import TestClient

    _setup_in_memory_db()
    try:
        with TestClient(app) as client:
            _, employer_headers, worker_token, worker_user_id = _setup_assigned_shift_sync(
                client, "pri04_emp@staffya.com", "pri04_w@staffya.com"
            )
            # Un token que vence en 1 segundo (el real dura 15 minutos).
            corto = _create_token(worker_user_id, ACCESS_TOKEN, timedelta(seconds=1))
            with client.websocket_connect(f"/api/v1/notifications/ws?token={corto}") as ws:
                time.sleep(2)  # el token ya venció
                assert _esperar_corte(ws) == 1008
    finally:
        app.dependency_overrides.clear()


def test_el_socket_de_chat_se_corta_cuando_vence_el_token():
    from fastapi.testclient import TestClient

    _setup_in_memory_db()
    try:
        with TestClient(app) as client:
            shift_id, _, _, worker_user_id = _setup_assigned_shift_sync(
                client, "pri04_chat_emp@staffya.com", "pri04_chat_w@staffya.com"
            )
            corto = _create_token(worker_user_id, ACCESS_TOKEN, timedelta(seconds=1))
            with client.websocket_connect(f"/api/v1/chats/{shift_id}/ws?token={corto}") as ws:
                time.sleep(2)
                assert _esperar_corte(ws) == 1008
    finally:
        app.dependency_overrides.clear()


def test_un_token_vigente_no_se_corta_y_sigue_entregando():
    """El corte es sólo al vencer: con el token vigente el socket sigue vivo y
    entrega (el aviso llega por el mismo socket que no se cortó)."""
    from fastapi.testclient import TestClient

    _setup_in_memory_db()
    try:
        with TestClient(app) as client:
            shift_id, employer_headers, worker_token, _ = _setup_assigned_shift_sync(
                client, "pri04_ok_emp@staffya.com", "pri04_ok_w@staffya.com"
            )
            with client.websocket_connect(f"/api/v1/chats/{shift_id}/ws?token={worker_token}") as ws:
                time.sleep(1)
                client.post(
                    f"/api/v1/chats/{shift_id}/messages",
                    headers=employer_headers,
                    json={"body": "Seguís conectado"},
                )
                assert ws.receive_json()["body"] == "Seguís conectado"
    finally:
        app.dependency_overrides.clear()


# --- las sesiones se revocan en bloque -----------------------------------------

_TOKEN_RE = re.compile(r"token=([A-Za-z0-9_\-]+)")


def test_cambiar_la_contrasena_corta_los_sockets_abiertos():
    from fastapi.testclient import TestClient

    fake_email = FakeEmailSender()
    _setup_in_memory_db()
    app.dependency_overrides[get_email_sender] = lambda: fake_email
    try:
        with TestClient(app) as client:
            shift_id, _, worker_token, _ = _setup_assigned_shift_sync(
                client, "pri04_rp_emp@staffya.com", "pri04_rp_w@staffya.com"
            )
            client.post("/api/v1/auth/forgot-password", json={"email": "pri04_rp_w@staffya.com"})
            match = _TOKEN_RE.search(fake_email.sent[-1].html)
            assert match is not None
            with (
                client.websocket_connect(f"/api/v1/notifications/ws?token={worker_token}") as avisos,
                client.websocket_connect(f"/api/v1/chats/{shift_id}/ws?token={worker_token}") as chat,
            ):
                reset = client.post(
                    "/api/v1/auth/reset-password",
                    json={"token": match.group(1), "new_password": "la-clave-nueva-del-barrido"},
                )
                assert reset.status_code == 204
                assert _esperar_corte(avisos) == 1008
                assert _esperar_corte(chat) == 1008
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def cierres(monkeypatch) -> list:
    """Anota a quién le cortan los sockets (sin abrir ninguno)."""
    anotados: list = []

    async def cerrar(user_id):
        anotados.append(user_id)
        return 0

    monkeypatch.setattr(ws_manager, "close_user_connections", cerrar)
    return anotados


@pytest.mark.asyncio
async def test_el_reclamo_por_google_corta_los_sockets(client: AsyncClient, cierres: list):
    """Google reclama una cuenta sin confirmar: cierra todas sus sesiones y
    corta lo que tuviera abierto."""

    class _Verificador:
        async def verify(self, id_token: str) -> GoogleIdentity:
            return GoogleIdentity(
                email="pri04_google@gmail.com", email_verified=True, full_name="Dueña"
            )

    await register_user(client, email="pri04_google@gmail.com", password="clave-del-otro-123")
    app.dependency_overrides[get_email_sender] = lambda: FakeEmailSender()
    app.dependency_overrides[get_google_verifier] = lambda: _Verificador()
    try:
        response = await client.post("/api/v1/auth/google", json={"id_token": "tok"})
        assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
        app.dependency_overrides.pop(get_google_verifier, None)
    assert len(cierres) == 1


@pytest.mark.asyncio
async def test_el_alta_de_dos_pasos_corta_los_sockets(
    client: AsyncClient, session_factory, cierres: list
):
    """Confirmar la verificación en dos pasos revoca las sesiones de antes
    (la contraseña robada no sobrevive): sus sockets también se cortan."""
    await make_admin(client, session_factory, "pri04_admin@staffya.com")
    assert len(cierres) == 1


# --- el gestor ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cerrar_las_conexiones_de_un_usuario_incluye_chat_y_solo_las_suyas():
    manager = ConnectionManager()
    yo, otro, turno = uuid4(), uuid4(), uuid4()
    mi_aviso, mi_chat, su_aviso, su_chat = (FakeWebSocket() for _ in range(4))
    manager.connect_notification(yo, mi_aviso)
    manager.connect_chat(turno, yo, mi_chat, user_id=yo)
    manager.connect_notification(otro, su_aviso)
    manager.connect_chat(turno, yo, su_chat, user_id=otro)  # el comercio, del mismo hilo

    assert await manager.close_user_connections(yo) == 2

    assert mi_aviso.close_code == 1008
    assert mi_chat.close_code == 1008
    assert su_aviso.close_code is None
    assert su_chat.close_code is None
    # Las suyas siguen entregando; las mías ya no están registradas.
    await manager.broadcast_chat(turno, yo, {"x": 1})
    assert su_chat.sent == [{"x": 1}]
    assert mi_chat.sent == []
