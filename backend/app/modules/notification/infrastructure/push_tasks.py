"""Tareas de fondo para los envíos de Web Push (2026-10-23).

Crear un aviso (postularse, asignar, chat, reseña, verificación) guarda la
notificación, la manda por WebSocket y busca las suscripciones push del
usuario dentro del request. Los POST al servicio de push (FCM, Mozilla,
Apple; hasta 10 s cada uno) salen después, en una tarea de `asyncio`, para
que quien hizo el pedido no los espere (ver `repositories.py::_schedule_pushes`).

- `asyncio` guarda sólo una referencia débil a cada tarea: una tarea sin
  otra referencia puede recolectarse a mitad de camino. Por eso quedan en
  `_pending` hasta que terminan.
- `drain_pending_pushes` espera las que están en curso: lo usan los tests
  (antes de mirar qué se envió) y el apagado de la app.
- `shutdown_pending_pushes` (lifespan de `app/main.py`) espera un tiempo
  acotado y deja en el log las que no llegaron, en vez de perderlas en
  silencio.
"""

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

logger = logging.getLogger(__name__)

# Lo que el lifespan espera al apagar: lo mismo que el timeout de un envío
# (`webpush_sender._PUSH_TIMEOUT_SECONDS`), así un proveedor lento alcanza.
SHUTDOWN_TIMEOUT_SECONDS = 10.0

_pending: set[asyncio.Task[None]] = set()


def spawn_push_task(coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
    """Corre `coro` en segundo plano y la guarda hasta que termine. La
    corrutina tiene que atrapar y loguear sus propios errores."""
    task = asyncio.create_task(coro, name="push-delivery")
    _pending.add(task)
    task.add_done_callback(_pending.discard)
    return task


def _pending_in_this_loop() -> set[asyncio.Task[None]]:
    # Sólo las del event loop actual: en los tests cada caso tiene su loop, y
    # una tarea de un loop ya cerrado no se puede esperar desde otro.
    loop = asyncio.get_running_loop()
    return {task for task in _pending if task.get_loop() is loop and not task.done()}


async def drain_pending_pushes(timeout: float | None = None) -> int:
    """Espera a que terminen los envíos de push en curso. Devuelve cuántos
    siguen pendientes al vencer `timeout` (0 si terminaron todos)."""
    pending = _pending_in_this_loop()
    if not pending:
        return 0
    _done, still_pending = await asyncio.wait(pending, timeout=timeout)
    return len(still_pending)


async def shutdown_pending_pushes(timeout: float = SHUTDOWN_TIMEOUT_SECONDS) -> int:
    """Al apagar: espera hasta `timeout` a los envíos en curso; los que no
    terminan se cancelan y quedan en el log. Devuelve cuántos se cancelaron."""
    pending = _pending_in_this_loop()
    if not pending:
        return 0
    logger.info("Apagado: esperando %d envío(s) de push en curso", len(pending))
    left = await drain_pending_pushes(timeout)
    if not left:
        return 0
    logger.warning(
        "Apagado: %d envío(s) de push sin terminar después de %.0f s; se cancelan",
        left,
        timeout,
    )
    for task in _pending_in_this_loop():
        task.cancel()
    return left
