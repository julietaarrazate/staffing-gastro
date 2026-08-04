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
# `DATABASE_URL`) — medido en docs/audits/PERFORMANCE_REPORT.md y en el PR de
# performance (branch `claude/performance`):
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
#   uvicorn (`backend/Dockerfile`, sin `--workers`) 5+10=15 conexiones
#   concurrentes alcanza de sobra y es compatible con el límite del pooler de
#   Neon en el plan free. Si se agregan workers uvicorn, este número se
#   multiplica por worker — revisar contra el límite de conexiones del plan
#   antes de escalar horizontalmente (ver SCALABILITY_REPORT.md).
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
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
