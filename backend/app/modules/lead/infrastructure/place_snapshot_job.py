"""Refresco de la copia semanal de OpenStreetMap por barrio (ADR-0029),
armado con los adaptadores reales.

Es un chequeo del scheduler en proceso (`shift/application/scheduler.py`,
inyectado desde `app/main.py` para no cruzar capas), como
`verification/infrastructure/file_cleanup_job.py`:

- `run_place_snapshot_refresh`: mira qué barrio toca (sin copia, o copia de
  más de 7 días) y, si hay uno, lo baja **en una tarea aparte**: la consulta
  a Overpass puede tardar minutos y no puede frenar el loop ni a los demás
  chequeos. Un barrio por vez: mientras la tarea corre, el chequeo no arranca
  otra. Devuelve cuándo vence la próxima copia, o `None` mientras hay una
  tarea andando (la tarea despierta al scheduler al terminar). Con todo al
  día, la próxima deadline es dentro de días: no agrega despertares (cuota
  de Neon).
- `request_refresh`: lo llama `POST /admin/leads/import` cuando el barrio no
  tiene copia todavía; lo pone primero en la cola y despierta al scheduler.

El estado de la cola (pedidos y barrios en pausa por una falla) vive en
memoria: el backend corre en un solo proceso (Render, un web service). Si se
reinicia, se pierde y no pasa nada: los barrios sin copia se bajan igual.
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal
from app.core.dt import naive
from app.modules.lead.application.services import PlaceSnapshotService
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.infrastructure.overpass_place_source import OverpassPlaceSource
from app.modules.lead.infrastructure.repositories import SqlAlchemyPlaceSnapshotRepository

logger = logging.getLogger(__name__)

# Un barrio que falló (todos los servidores, con sus reintentos) descansa
# antes de volver a probarse: 1 h, y el doble por cada falla seguida, hasta
# 7 días. Un barrio que falla siempre (p. ej. su nombre no coincide en OSM)
# termina probándose una vez por semana, no cada hora para siempre.
REST_AFTER_FAILURE = timedelta(hours=1)
MAX_REST = timedelta(days=7)
# Y tras una falla se frena todo el refresco: casi siempre el problema es de
# los servidores, no del barrio. 30 min, el doble por cada falla seguida de
# cualquier barrio, hasta 24 h; vuelve a cero con el primer éxito. Así, con
# Overpass caído, Neon no se despierta una o dos veces por hora.
PAUSE_AFTER_FAILURE = timedelta(minutes=30)
MAX_PAUSE = timedelta(hours=24)
# Un barrio pedido desde la pantalla se salta la pausa general, pero como
# mucho una vez cada 15 min (apretar el botón muchas veces no insiste más).
REQUEST_BYPASS_EVERY = timedelta(minutes=15)
# Una consulta legítima tarda a lo sumo ~42 min (3 vueltas × 4 servidores ×
# 180 s, más las esperas). Pasada 1 h, la tarea se da por colgada.
HUNG_AFTER = timedelta(minutes=60)
# Pausa entre un barrio y el siguiente, por cortesía con Overpass.
PAUSE_BETWEEN_BARRIOS_S = 30.0


def _system_clock() -> datetime:
    return datetime.now(timezone.utc)


_clock: Callable[[], datetime] = _system_clock
_requested: list[str] = []
_resting_until: dict[str, datetime] = {}
_barrio_failures: dict[str, int] = {}
_last_bypass: dict[str, datetime] = {}
_paused_until: datetime | None = None
_global_failures = 0
_task: asyncio.Task | None = None
_task_barrio: str | None = None
_task_started_at: datetime | None = None
_wake: Callable[[], None] | None = None


def enable(wake: Callable[[], None]) -> None:
    """Prende el refresco (sólo con el scheduler corriendo, en producción).
    `wake` despierta al scheduler; lo pasa `app/main.py`."""
    global _wake
    _wake = wake


def set_clock(clock: Callable[[], datetime]) -> None:
    """Reloj del refresco (UTC con zona). Sólo los tests lo cambian."""
    global _clock
    _clock = clock


def request_refresh(barrio: str) -> None:
    """La pantalla pidió un barrio sin copia: va primero en la cola."""
    if barrio in _requested:
        _requested.remove(barrio)
    _requested.insert(0, barrio)
    if _wake is not None:
        _wake()


def is_refreshing() -> bool:
    return _task is not None and not _task.done()


def cancel() -> None:
    """Cancela la tarea de refresco en curso (al apagar, desde `app/main.py`)."""
    if is_refreshing():
        assert _task is not None
        _task.cancel()


async def wait_until_idle() -> None:
    """Espera a que termine la tarea de refresco en curso (para los tests)."""
    if _task is not None:
        await asyncio.gather(_task, return_exceptions=True)


def reset() -> None:
    """Vacía el estado en memoria (para los tests)."""
    global _task, _task_barrio, _task_started_at, _wake, _paused_until
    global _global_failures, _clock
    try:
        cancel()
    except RuntimeError:  # la tarea era del event loop de otro test, ya cerrado
        pass
    _requested.clear()
    _resting_until.clear()
    _barrio_failures.clear()
    _last_bypass.clear()
    _task = None
    _task_barrio = None
    _task_started_at = None
    _wake = None
    _paused_until = None
    _global_failures = 0
    _clock = _system_clock


def _record_failure(barrio: str, failed_at: datetime) -> None:
    """Descanso del barrio y pausa general, los dos con backoff exponencial."""
    global _paused_until, _global_failures
    n = _barrio_failures.get(barrio, 0)
    _resting_until[barrio] = failed_at + min(REST_AFTER_FAILURE * 2**n, MAX_REST)
    _barrio_failures[barrio] = n + 1
    _paused_until = failed_at + min(PAUSE_AFTER_FAILURE * 2**_global_failures, MAX_PAUSE)
    _global_failures += 1


def _record_success(barrio: str) -> None:
    global _paused_until, _global_failures
    _resting_until.pop(barrio, None)
    _barrio_failures.pop(barrio, None)
    _paused_until = None
    _global_failures = 0


def _can_bypass(barrio: str, now: datetime) -> bool:
    last = _last_bypass.get(barrio)
    return barrio in _requested and (last is None or now - last >= REQUEST_BYPASS_EVERY)


async def _refresh_one(
    sessions: async_sessionmaker[AsyncSession],
    places: PlaceSource,
    barrio: str,
    pause_s: float,
) -> None:
    failed = False
    try:
        # La sesión no toma conexión hasta la primera consulta, y el caso de
        # uso consulta a Overpass antes de tocar la base.
        async with sessions() as session:
            count = await PlaceSnapshotService(
                SqlAlchemyPlaceSnapshotRepository(session), places
            ).refresh(barrio, _clock())
    except Exception as exc:
        failed = True
        _record_failure(barrio, _clock())
        logger.warning(
            "lead.snapshot_failed barrio=%s error=%s %s; queda la copia anterior "
            "(pausa general hasta %s)",
            barrio,
            type(exc).__name__,
            str(exc)[:160],
            _paused_until.isoformat() if _paused_until else "-",
        )
    else:
        _record_success(barrio)
        logger.info("lead.snapshot_refreshed barrio=%s comercios=%d", barrio, count)
    finally:
        if barrio in _requested:
            _requested.remove(barrio)
    # Tras una falla sigue una pausa: no hace falta despertar al scheduler
    # (sería despertar a Neon para nada). La próxima pasada del loop, a su
    # hora, ve la pausa y devuelve cuándo termina. Sólo se despierta si hay
    # un barrio pedido desde la pantalla que puede saltársela.
    if failed and not any(_can_bypass(b, _clock()) for b in _requested):
        return
    if pause_s > 0:
        await asyncio.sleep(pause_s)
    if _wake is not None:
        _wake()


def _drop_hung_task(now: datetime) -> None:
    """Una tarea que lleva más de `HUNG_AFTER` se cancela y cuenta como falla."""
    global _task
    if _task_started_at is None or now - _task_started_at < HUNG_AFTER:
        return
    assert _task is not None and _task_barrio is not None
    logger.error(
        "lead.snapshot_hung barrio=%s desde=%s; se cancela",
        _task_barrio,
        _task_started_at.isoformat(),
    )
    _task.cancel()
    _task = None
    _record_failure(_task_barrio, now)


async def run_place_snapshot_refresh(
    sessions: async_sessionmaker[AsyncSession] | None = None,
    places: PlaceSource | None = None,
    now: datetime | None = None,
    pause_s: float = PAUSE_BETWEEN_BARRIOS_S,
) -> datetime | None:
    """Chequeo del scheduler. Devuelve la próxima deadline (naive UTC, como
    el resto de los chequeos) o `None`. Los parámetros son para los tests;
    el scheduler lo llama sin ninguno."""
    global _task, _task_barrio, _task_started_at
    now = now or _clock()
    if is_refreshing():
        _drop_hung_task(now)
        if is_refreshing():
            # Al terminar bien despierta al scheduler. Si falla, no (sigue una
            # pausa) y una tarea colgada se detecta en la próxima pasada que
            # el loop haga por su cuenta: no se agregan despertares.
            return None
    sessions = sessions or AsyncSessionLocal
    async with sessions() as session:
        barrio, next_at = await PlaceSnapshotService(
            SqlAlchemyPlaceSnapshotRepository(session), places or OverpassPlaceSource()
        ).plan(now, requested=tuple(_requested), resting_until=dict(_resting_until))
    if barrio is None:
        return naive(next_at) if next_at is not None else None
    if _paused_until is not None and now < _paused_until:
        if not _can_bypass(barrio, now):
            wake_at = _paused_until
            last = _last_bypass.get(barrio)
            if barrio in _requested and last is not None:
                wake_at = min(wake_at, last + REQUEST_BYPASS_EVERY)
            return naive(wake_at)
        _last_bypass[barrio] = now
    _task_barrio = barrio
    _task_started_at = now
    _task = asyncio.create_task(
        _refresh_one(sessions, places or OverpassPlaceSource(), barrio, pause_s),
        name=f"lead-snapshot-{barrio}",
    )
    return None
