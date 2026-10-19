"""Configuración de la base de datos (SQLAlchemy 2.0 async).

Expone:
- `Base`: clase declarativa base para los modelos ORM.
- `engine`: motor async.
- `get_session`: dependencia de FastAPI que entrega una sesión por request.
- `start_idle_connection_closer`: cierra la conexión que queda en el pool
  cuando nadie usa la app, para que Neon pueda dormirse.
"""

import asyncio
import logging
import time
from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Clase base declarativa para todos los modelos ORM."""


# Tuning de pool para una base remota (Neon, vía el endpoint `-pooler` en
# `DATABASE_URL`) — medido en docs/audits/PERFORMANCE_REPORT.md y en el PR de
# performance:
#
# - HOTFIX (post-#95): `pool_pre_ping` vuelve a estar prendido. El PR #95 lo
#   había sacado a favor de `pool_recycle=280` solo, razonando que reciclar
#   proactivamente por EDAD evitaba el error que `pre_ping` prevenía. Pero
#   `pool_recycle` sólo mira la edad de la conexión desde que se abrió, no
#   hace cuánto está *ociosa* — y el pooler de Neon (o cualquier firewall/LB
#   intermedio) puede cortar una conexión inactiva mucho antes de los 280s.
#   En una beta de bajo tráfico, con huecos largos entre requests, eso pasa
#   seguido: el primer request después de un hueco agarra una conexión ya
#   cortada del otro lado y el driver cuelga o tira error de conexión — se
#   siente como "la app está lenta/trabada", justo el síntoma reportado tras
#   el deploy de #95. `pre_ping` hace un `SELECT 1` en cada checkout (~1ms
#   medido en loopback, unas pocas decenas de ms reales contra Neon) y
#   reconecta transparentemente si la conexión está muerta — el costo fijo
#   por request es preferible a colgarse post error intermitente. Se
#   mantiene `pool_recycle=280` como medida complementaria (fuerza el
#   reciclado proactivo por edad); ambas resuelven problemas distintos y la
#   combinación es la recomendada por SQLAlchemy para bases remotas.
# - `pool_size`/`max_overflow` explícitos (antes eran el default implícito de
#   `AsyncAdaptedQueuePool`, 5/10 — ver P/pool en PERFORMANCE_REPORT.md):
#   documentados acá en vez de dejarlos implícitos. Con un solo worker
#   uvicorn (`backend/Dockerfile`, sin `--workers`) `pool_size + max_overflow`
#   conexiones concurrentes alcanza de sobra y es compatible con el límite del
#   pooler de Neon en el plan free. Si se agregan workers uvicorn, este número
#   se multiplica por worker — revisar contra el límite de conexiones del plan
#   antes de escalar horizontalmente (ver SCALABILITY_REPORT.md).
# - INCIDENTE 2026-08-26: `pool_size` bajó de 5 a 1. `pool_size` conexiones
#   quedan ABIERTAS en el pool aunque no haya requests — y Neon (plan free)
#   sólo suspende el cómputo (deja de contar horas) cuando ve CERO conexiones
#   activas. Con 5 conexiones ociosas sosteniéndose todo el día, más el
#   scheduler tocando la base cada pocos minutos (ver `shift/application/
#   scheduler.py`), el cómputo nunca llegaba a dormir: ~441 horas activas en
#   menos de un mes, cuota mensual del free tier agotada
#   (`NeonDbError 402: exceeded the compute time quota`), app entera caída
#   hasta el reset. `max_overflow=10` sigue cubriendo picos de concurrencia
#   real (esas conexiones se abren bajo demanda y se cierran solas al
#   liberarse, no sostienen el cómputo despierto en reposo) — sólo se achica
#   el piso que queda permanentemente abierto. Costo: la primera consulta
#   tras un hueco largo paga la reconexión (cubierta por `pool_pre_ping`,
#   unas pocas decenas de ms) en vez de reusar una conexión ya viva —
#   aceptable para el volumen de tráfico de la beta actual.
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=1,
    max_overflow=10,
)

# --- Cerrar la conexión ociosa (2026-10-13) ---------------------------------
#
# `pool_size=1` deja UNA conexión abierta en el pool para siempre, aunque nadie
# use la app. Con Render en el plan free no importaba: el servidor se duerme a
# los 15 minutos sin tráfico y la conexión se corta con él. Con Render pago
# (siempre prendido) esa conexión quedaría abierta día y noche, y una conexión
# abierta puede impedir que Neon suspenda el cómputo: serían ~180 CU-h por
# mes contra las 100 del plan free (cuenta en docs/historial/
# 2026-10-13-neon-dormir.md). Neon documenta que suspende tras 5 minutos de
# inactividad, no si una conexión ociosa cuenta como actividad, así que se
# cierra igual: si no la cuenta, cerrarla no cuesta nada; si la cuenta, es lo
# que deja dormir a la base.
#
# Cómo: el pool anota la hora de cada uso (checkout/checkin). Una tarea de
# fondo mira cada `IDLE_CHECK_EVERY` y, si pasaron `IDLE_CLOSE_AFTER` sin uso
# y no hay ninguna conexión prestada, descarta el pool (`engine.dispose()`),
# que cierra las conexiones guardadas. El próximo request abre una nueva
# (lo que ya pasaba tras un hueco largo: `pool_pre_ping` la reponía). La tarea
# no toca la base: sólo mira el reloj y el pool en memoria.
IDLE_CLOSE_AFTER = 120.0  # segundos sin uso; bien por debajo de los 5 min de Neon
IDLE_CHECK_EVERY = 30.0

_last_pool_use = time.monotonic()


def _mark_pool_use(*_args: object) -> None:
    global _last_pool_use
    _last_pool_use = time.monotonic()


def track_pool_use(eng: AsyncEngine) -> None:
    """Anota cada préstamo y devolución de una conexión del pool. Los
    listeners sobreviven a `dispose()` (el pool nuevo hereda los eventos)."""
    event.listen(eng.sync_engine, "checkout", _mark_pool_use)
    event.listen(eng.sync_engine, "checkin", _mark_pool_use)


track_pool_use(engine)


async def close_idle_connections(now: float | None = None) -> bool:
    """Cierra las conexiones guardadas en el pool si nadie lo usó en
    `IDLE_CLOSE_AFTER` segundos y no hay ninguna prestada. Devuelve si cerró."""
    now = time.monotonic() if now is None else now
    pool = engine.pool
    if now - _last_pool_use < IDLE_CLOSE_AFTER:
        return False
    if pool.checkedout() > 0 or pool.checkedin() == 0:
        return False
    await engine.dispose()
    logging.getLogger(__name__).info("db.idle_connections_closed")
    return True


async def _idle_connection_closer_loop() -> None:
    while True:
        await asyncio.sleep(IDLE_CHECK_EVERY)
        try:
            await close_idle_connections()
        except Exception:
            # Best-effort: un error acá no debe matar el loop ni la app.
            logging.getLogger(__name__).exception("Error cerrando conexiones ociosas")


def start_idle_connection_closer() -> asyncio.Task | None:
    """Arranca la tarea de fondo, sólo en producción (mismo criterio que el
    scheduler: nunca corre en `pytest` ni en local sin querer)."""
    if not settings.is_production:
        return None
    return asyncio.create_task(_idle_connection_closer_loop())


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependencia que provee una sesión async por request y la cierra al final."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
