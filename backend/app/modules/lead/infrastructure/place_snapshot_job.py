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

# Un barrio que falló (todos los servidores, con sus reintentos) no se vuelve
# a probar hasta dentro de un rato: los servidores públicos se saturan por
# horas y no conviene insistirles.
REST_AFTER_FAILURE = timedelta(hours=1)
# Y después de una falla se frena todo el refresco un rato: casi siempre el
# problema es de los servidores, no del barrio, y seguir con el próximo sería
# insistirles igual. Un barrio pedido desde la pantalla no espera esta pausa
# (sí la de su propio barrio, si falló).
PAUSE_AFTER_FAILURE = timedelta(minutes=30)
# Pausa entre un barrio y el siguiente, por cortesía con Overpass.
PAUSE_BETWEEN_BARRIOS_S = 30.0

_requested: list[str] = []
_resting_until: dict[str, datetime] = {}
_paused_until: datetime | None = None
_task: asyncio.Task | None = None
_wake: Callable[[], None] | None = None


def enable(wake: Callable[[], None]) -> None:
    """Prende el refresco (sólo con el scheduler corriendo, en producción).
    `wake` despierta al scheduler; lo pasa `app/main.py`."""
    global _wake
    _wake = wake


def request_refresh(barrio: str) -> None:
    """La pantalla pidió un barrio sin copia: va primero en la cola."""
    if barrio in _requested:
        _requested.remove(barrio)
    _requested.insert(0, barrio)
    if _wake is not None:
        _wake()


def is_refreshing() -> bool:
    return _task is not None and not _task.done()


async def wait_until_idle() -> None:
    """Espera a que termine la tarea de refresco en curso (para los tests)."""
    if _task is not None:
        await asyncio.gather(_task, return_exceptions=True)


def reset() -> None:
    """Vacía el estado en memoria (para los tests)."""
    global _task, _wake, _paused_until
    _requested.clear()
    _resting_until.clear()
    _task = None
    _wake = None
    _paused_until = None


async def _refresh_one(
    sessions: async_sessionmaker[AsyncSession],
    places: PlaceSource,
    barrio: str,
    pause_s: float,
) -> None:
    global _paused_until
    now = datetime.now(timezone.utc)
    try:
        # La sesión no toma conexión hasta la primera consulta, y el caso de
        # uso consulta a Overpass antes de tocar la base.
        async with sessions() as session:
            count = await PlaceSnapshotService(
                SqlAlchemyPlaceSnapshotRepository(session), places
            ).refresh(barrio, now)
    except Exception as exc:
        failed_at = datetime.now(timezone.utc)
        _resting_until[barrio] = failed_at + REST_AFTER_FAILURE
        _paused_until = failed_at + PAUSE_AFTER_FAILURE
        logger.warning(
            "lead.snapshot_failed barrio=%s error=%s %s; queda la copia anterior",
            barrio,
            type(exc).__name__,
            str(exc)[:160],
        )
    else:
        _resting_until.pop(barrio, None)
        logger.info("lead.snapshot_refreshed barrio=%s comercios=%d", barrio, count)
    finally:
        if barrio in _requested:
            _requested.remove(barrio)
    if pause_s > 0:
        await asyncio.sleep(pause_s)
    if _wake is not None:
        _wake()


async def run_place_snapshot_refresh(
    sessions: async_sessionmaker[AsyncSession] | None = None,
    places: PlaceSource | None = None,
    now: datetime | None = None,
    pause_s: float = PAUSE_BETWEEN_BARRIOS_S,
) -> datetime | None:
    """Chequeo del scheduler. Devuelve la próxima deadline (naive UTC, como
    el resto de los chequeos) o `None`. Los parámetros son para los tests;
    el scheduler lo llama sin ninguno."""
    global _task
    if is_refreshing():
        return None
    sessions = sessions or AsyncSessionLocal
    now = now or datetime.now(timezone.utc)
    async with sessions() as session:
        barrio, next_at = await PlaceSnapshotService(
            SqlAlchemyPlaceSnapshotRepository(session), places or OverpassPlaceSource()
        ).plan(now, requested=tuple(_requested), resting_until=dict(_resting_until))
    if barrio is None:
        return naive(next_at) if next_at is not None else None
    if _paused_until is not None and now < _paused_until and barrio not in _requested:
        return naive(_paused_until)
    _task = asyncio.create_task(
        _refresh_one(sessions, places or OverpassPlaceSource(), barrio, pause_s),
        name=f"lead-snapshot-{barrio}",
    )
    return None
