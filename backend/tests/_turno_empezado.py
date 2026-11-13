"""Helper de tests: «No se presentó» sólo se puede marcar desde 15 minutos
después del inicio (hallazgo U079), así que los tests que lo ejercitan
mueven el turno al pasado directo en la base (no hay endpoint para eso)."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

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
