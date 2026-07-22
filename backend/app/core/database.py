"""Configuración de la base de datos (SQLAlchemy 2.0 async).

Expone:
- `Base`: clase declarativa base para los modelos ORM.
- `engine`: motor async.
- `get_session`: dependencia de FastAPI que entrega una sesión por request.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Clase base declarativa para todos los modelos ORM."""


# Tuning de pool para una base remota (Neon, vía el endpoint `-pooler` en
# `DATABASE_URL`) — medido en docs/PERFORMANCE_REPORT.md y en el PR de
# performance (branch `claude/performance`):
#
# - `pool_pre_ping` quedó afuera. Hace un `SELECT 1` (round-trip completo) en
#   CADA checkout de conexión del pool, no sólo tras reciclar. Medido contra
#   un Postgres real (loopback, sin la distancia de red a Neon):
#   pool_pre_ping=True → 1.17 ms/checkout vs. False → 0.80 ms/checkout
#   (+46%, 500 checkouts x 3 corridas, script en
#   `docs/PERFORMANCE_REPORT.md` §Pool). Es UN round-trip fijo agregado por
#   checkout; con Neon en otra región (decenas de ms de RTT, no microsegundos
#   de loopback) ese mismo round-trip pesa mucho más que acá. Con un solo
#   worker uvicorn y pool chico, la mayoría de los requests reusan conexiones
#   ya abiertas → pagan ese ping de más en el camino caliente.
# - En su lugar, `pool_recycle=280` fuerza a soltar y reabrir cualquier
#   conexión con más de ~4.5 min de vida ANTES de que el pooler de Neon (o un
#   firewall/balanceador intermedio) la cierre él solo por inactividad — eso
#   sí evitaría el error real que `pre_ping` buscaba prevenir (usar una
#   conexión ya cortada del otro lado), pero de forma proactiva y sin costo
#   por request: el reciclado ocurre una vez cada 280s, no en cada checkout.
# - `pool_size`/`max_overflow` explícitos (antes eran el default implícito de
#   `AsyncAdaptedQueuePool`, 5/10 — ver P/pool en PERFORMANCE_REPORT.md):
#   documentados acá en vez de dejarlos implícitos. Con un solo worker
#   uvicorn (`backend/Dockerfile`, sin `--workers`) 5+10=15 conexiones
#   concurrentes alcanza de sobra y es compatible con el límite del pooler de
#   Neon en el plan free. Si se agregan workers uvicorn, este número se
#   multiplica por worker — revisar contra el límite de conexiones del plan
#   antes de escalar horizontalmente (ver SCALABILITY_REPORT.md).
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_recycle=280,
    pool_size=5,
    max_overflow=10,
)

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
