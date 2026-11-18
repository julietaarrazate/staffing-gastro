"""Regla de puntualidad del check-in (R2.4, docs/reference/REPUTATION.md)."""

from datetime import datetime, timedelta

from app.core.dt import naive as _naive

# Cuánto después del horario pactado se puede marcar la llegada y seguir
# contando como puntual. Llegar antes nunca resta: la app deja marcar hasta
# 30 min antes (`EARLY_CHECKIN_WINDOW`) y quien llega temprano es puntual.
PUNCTUALITY_TOLERANCE = timedelta(minutes=15)


def arrived_on_time(check_in_at: datetime | None, start_at: datetime) -> bool:
    """Puntual = llegó hasta 15 min después del inicio; antes, siempre.

    Sin check-in no hay llegada: no es puntual. Normaliza a "naive" (en
    SQLite los datetimes vuelven sin tzinfo; se asume UTC en ambos).
    """
    if check_in_at is None:
        return False
    return _naive(check_in_at) - _naive(start_at) <= PUNCTUALITY_TOLERANCE


def punctuality_of(
    check_in_at: datetime | None, start_at: datetime, taken_after_start: bool
) -> bool | None:
    """Qué le suma este turno a la puntualidad de quien lo trabajó: `True`
    (puntual), `False` (tarde) o `None` (no la mueve).

    Quien tomó un turno reofrecido ya empezado (`Shift.taken_after_start`: el
    reemplazo, U080) no tiene una hora pactada contra la cual medirlo: el
    turno cuenta como completado y **su puntualidad no se mueve, ni a favor
    ni en contra**. Si no llega, la ausencia sí cuenta. En un turno común se
    mide contra `start_at` aunque la persona haya confirmado tarde.

    Es el único lugar que lo decide. Si más adelante se quiere medir «llegó
    hasta X minutos después de confirmar», se cambia acá.
    """
    if taken_after_start:
        return None
    return arrived_on_time(check_in_at, start_at)
