"""Señal de "despertá al scheduler ya" del ciclo de vida del turno.

Módulo minúsculo y sin dependencias de dominio **a propósito**: lo importan
tanto el loop del scheduler (`scheduler.py`) como el servicio que crea las
deadlines nuevas (`services.py`), sin acoplar esos dos entre sí ni provocar
un import circular (hoy `scheduler` importa `services`, nunca al revés).

Por qué existe: el scheduler dejó de sondear cada 5 minutos (ver
`scheduler.py`, incidente 2026-08-26 de cuota de Neon) y ahora duerme hasta
la próxima deadline conocida. Ese diseño necesita que, cuando aparece una
deadline nueva mientras el loop duerme, alguien lo despierte antes de tiempo
— si no, un turno recién publicado no se escalaría hasta el próximo despertar
(que puede ser horas después). Las dos acciones que crean deadlines nuevas
son publicar un turno (escalada a los `ESCALATION_DELAY`) y confirmar uno
(recordatorio/no-show alrededor de su `start_at`); ambas llaman a
`notify_scheduler()` al terminar.
"""

import asyncio

# Un único Event compartido por todo el proceso. En 3.11 `asyncio.Event()` no
# se ata a un loop al construirse (lo toma perezosamente en el primer `wait`),
# así que es seguro crearlo al importar el módulo, antes de que arranque el
# loop de FastAPI.
_wakeup = asyncio.Event()


def notify_scheduler() -> None:
    """Despierta al scheduler cuanto antes porque apareció una deadline nueva.

    Idempotente: setear un Event ya seteado no hace nada, así que una ráfaga
    de publicaciones no genera una tormenta de despertares — el loop se
    despierta una vez y recalcula la próxima deadline sobre todas.

    Sin scheduler corriendo (tests, desarrollo: `settings.is_production`
    False) es un **no-op inofensivo**: setear un Event que nadie espera no
    falla ni bloquea; el próximo `wait_for_wakeup` que llegue a existir lo
    consumirá o lo limpiará.
    """
    _wakeup.set()


async def wait_for_wakeup(timeout_seconds: float) -> None:
    """Espera hasta `timeout_seconds`, o hasta que llegue una señal, lo que
    ocurra primero, y consume la señal antes de volver.

    Reemplaza al viejo `asyncio.sleep(CHECK_INTERVAL)` del loop: el scheduler
    duerme exactamente hasta la próxima deadline calculada, pero puede ser
    interrumpido antes por `notify_scheduler()` cuando entra trabajo nuevo.
    """
    try:
        await asyncio.wait_for(_wakeup.wait(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        # Se cumplió el tiempo de dormir sin señal — es el caso normal.
        pass
    finally:
        # Se consume la señal (si la hubo) para que el próximo ciclo vuelva a
        # dormir hasta su deadline en vez de girar en falso.
        _wakeup.clear()
