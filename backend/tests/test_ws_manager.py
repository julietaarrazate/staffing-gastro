"""Tests del tope de conexiones concurrentes de ConnectionManager
(PRODUCTION_HARDENING.md, TECH_DEBT S2). No pasa por HTTP/WS real: alcanza
con ejercitar la lógica de conteo, que es donde vive el riesgo nuevo."""

from uuid import uuid4

from app.core.ws_manager import MAX_CONNECTIONS_PER_KEY, ConnectionManager


def test_connect_chat_rejects_past_the_cap():
    manager = ConnectionManager()
    shift_id = uuid4()
    accepted = [
        manager.connect_chat(shift_id, object()) for _ in range(MAX_CONNECTIONS_PER_KEY + 3)
    ]
    assert accepted.count(True) == MAX_CONNECTIONS_PER_KEY
    assert accepted.count(False) == 3


def test_connect_notification_rejects_past_the_cap():
    manager = ConnectionManager()
    user_id = uuid4()
    accepted = [
        manager.connect_notification(user_id, object()) for _ in range(MAX_CONNECTIONS_PER_KEY + 2)
    ]
    assert accepted.count(True) == MAX_CONNECTIONS_PER_KEY
    assert accepted.count(False) == 2


def test_disconnect_frees_a_slot():
    manager = ConnectionManager()
    shift_id = uuid4()
    sockets = [object() for _ in range(MAX_CONNECTIONS_PER_KEY)]
    for ws in sockets:
        assert manager.connect_chat(shift_id, ws) is True
    # Al tope: la próxima conexión se rechaza.
    assert manager.connect_chat(shift_id, object()) is False
    # Libera una conexión existente: la próxima ya entra.
    manager.disconnect_chat(shift_id, sockets[0])
    assert manager.connect_chat(shift_id, object()) is True


def test_different_shifts_have_independent_caps():
    manager = ConnectionManager()
    shift_a, shift_b = uuid4(), uuid4()
    for _ in range(MAX_CONNECTIONS_PER_KEY):
        assert manager.connect_chat(shift_a, object()) is True
    # El tope de un turno no consume el cupo de otro.
    assert manager.connect_chat(shift_b, object()) is True
