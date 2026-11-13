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
