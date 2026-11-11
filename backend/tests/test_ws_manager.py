"""Tests de ConnectionManager: el tope de conexiones concurrentes
(PRODUCTION_HARDENING.md, TECH_DEBT S2) y la entrega del chat por hilo. No
pasa por HTTP/WS real: alcanza con ejercitar la lógica del gestor."""

import asyncio
from uuid import uuid4

from app.core.ws_manager import MAX_CONNECTIONS_PER_KEY, ConnectionManager


class FakeWebSocket:
    """Lo mínimo que usa el gestor de un WebSocket: anota lo que le mandan y
    si lo cerraron. Con `broken=True` falla al enviar, como un socket caído."""

    def __init__(self, broken: bool = False) -> None:
        self.sent: list[dict] = []
        self.close_code: int | None = None
        self.broken = broken

    async def send_json(self, payload: dict) -> None:
        if self.broken:
            raise RuntimeError("socket caído")
        self.sent.append(payload)

    async def close(self, code: int = 1000) -> None:
        self.close_code = code


def test_connect_chat_rejects_past_the_cap():
    manager = ConnectionManager()
    shift_id, worker = uuid4(), uuid4()
    accepted = [
        manager.connect_chat(shift_id, worker, object())
        for _ in range(MAX_CONNECTIONS_PER_KEY + 3)
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
    shift_id, worker = uuid4(), uuid4()
    sockets = [object() for _ in range(MAX_CONNECTIONS_PER_KEY)]
    for ws in sockets:
        assert manager.connect_chat(shift_id, worker, ws) is True
    # Al tope: la próxima conexión se rechaza.
    assert manager.connect_chat(shift_id, worker, object()) is False
    # Libera una conexión existente: la próxima ya entra.
    manager.disconnect_chat(shift_id, sockets[0])
    assert manager.connect_chat(shift_id, worker, object()) is True


def test_different_shifts_have_independent_caps():
    manager = ConnectionManager()
    shift_a, shift_b, worker = uuid4(), uuid4(), uuid4()
    for _ in range(MAX_CONNECTIONS_PER_KEY):
        assert manager.connect_chat(shift_a, worker, object()) is True
    # El tope de un turno no consume el cupo de otro.
    assert manager.connect_chat(shift_b, worker, object()) is True


def test_the_cap_is_per_shift_across_threads():
    """El tope sigue siendo por turno: las conexiones que quedaron abiertas
    sobre un hilo anterior cuentan hasta que se cortan."""
    manager = ConnectionManager()
    shift_id = uuid4()
    for _ in range(MAX_CONNECTIONS_PER_KEY):
        assert manager.connect_chat(shift_id, uuid4(), object()) is True
    assert manager.connect_chat(shift_id, uuid4(), object()) is False


async def test_broadcast_chat_delivers_only_to_that_thread_and_closes_the_rest():
    """El chat es del comercio con UNA persona asignada: lo que se manda en un
    hilo llega sólo a las conexiones abiertas sobre ese hilo. Las del mismo
    turno abiertas sobre otro hilo (quedaron de antes de una reasignación) no
    reciben nada y se cortan; las de otros turnos ni se tocan."""
    manager = ConnectionManager()
    shift_id, other_shift = uuid4(), uuid4()
    previous_worker, current_worker = uuid4(), uuid4()
    stale, current, elsewhere = FakeWebSocket(), FakeWebSocket(), FakeWebSocket()
    manager.connect_chat(shift_id, previous_worker, stale)
    manager.connect_chat(shift_id, current_worker, current)
    manager.connect_chat(other_shift, previous_worker, elsewhere)

    await manager.broadcast_chat(shift_id, current_worker, {"type": "message"})
    # El cierre sale en segundo plano (no frena el envío): un paso del loop.
    await asyncio.sleep(0)

    assert current.sent == [{"type": "message"}]
    assert current.close_code is None
    assert stale.sent == []
    assert stale.close_code == 1008
    assert elsewhere.sent == []
    assert elsewhere.close_code is None

    # La conexión cortada dejó de ocupar lugar y no vuelve a recibir, aunque
    # después se escriba en el hilo sobre el que se había abierto.
    await manager.broadcast_chat(shift_id, previous_worker, {"type": "message"})
    assert stale.sent == []


async def test_broadcast_chat_drops_a_broken_connection():
    manager = ConnectionManager()
    shift_id, worker = uuid4(), uuid4()
    broken, healthy = FakeWebSocket(broken=True), FakeWebSocket()
    manager.connect_chat(shift_id, worker, broken)
    manager.connect_chat(shift_id, worker, healthy)

    await manager.broadcast_chat(shift_id, worker, {"type": "message"})
    await manager.broadcast_chat(shift_id, worker, {"type": "read"})

    assert healthy.sent == [{"type": "message"}, {"type": "read"}]
    assert broken.sent == []
