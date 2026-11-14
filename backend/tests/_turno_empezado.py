"""Helper de tests: «No se presentó» sólo se puede marcar desde 15 minutos
después del inicio (hallazgo U079), así que los tests que lo ejercitan
mueven el turno al pasado directo en la base (no hay endpoint para eso)."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.core.database import get_session
from app.main import app
from app.modules.shift.infrastructure.models import ShiftModel


async def empezar_turno(session_factory, shift_id: str, minutos: int = 20) -> None:
    """Hace que el turno haya empezado hace `minutos`, conservando su duración."""
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        duracion = model.end_at - model.start_at
        nuevo = datetime.now(timezone.utc) - timedelta(minutes=minutos)
        model.start_at = nuevo
        model.end_at = nuevo + duracion
        await session.commit()


async def empezar_turno_de_la_app(shift_id: str, minutos: int = 20) -> None:
    """Igual que `empezar_turno`, pero escribe por la misma sesión que usa el
    `client` (el `get_session` sobrescrito en `app.dependency_overrides`), sin
    exigir la fixture `session_factory`: sirve a helpers compartidos entre
    archivos, que no saben con qué base corre cada test."""
    sesiones = app.dependency_overrides[get_session]()
    session = await sesiones.__anext__()
    try:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        duracion = model.end_at - model.start_at
        nuevo = datetime.now(timezone.utc) - timedelta(minutes=minutos)
        model.start_at = nuevo
        model.end_at = nuevo + duracion
        await session.commit()
    finally:
        await sesiones.aclose()


async def correr_reloj_del_turno(shift_id: str, minutos: int) -> None:
    """Hace de cuenta que pasaron `minutos`: corre para atrás el inicio, el fin
    y, si ya está marcada, la llegada. Sirve cuando importa la distancia entre
    la llegada y el inicio (por ejemplo, quien llegó 24 minutos antes) y además
    hace falta que el turno ya haya empezado (la salida sólo se marca desde el
    inicio). Escribe por la sesión del `client`, como `empezar_turno_de_la_app`."""
    sesiones = app.dependency_overrides[get_session]()
    session = await sesiones.__anext__()
    try:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        atras = timedelta(minutes=minutos)
        model.start_at = model.start_at - atras
        model.end_at = model.end_at - atras
        if model.check_in_at is not None:
            model.check_in_at = model.check_in_at - atras
        await session.commit()
    finally:
        await sesiones.aclose()
