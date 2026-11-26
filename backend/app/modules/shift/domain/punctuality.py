"""Regla de puntualidad del check-in (R2.4, docs/reference/REPUTATION.md)."""

from datetime import datetime, timedelta

from app.core.dt import naive as _naive

# Puntual es estar a la hora de inicio (puntualidad real, ADR-0008 act.
# 2026-11-26). Este margen es sólo para el trámite de marcar (sacar el
# celular, que haya señal), no para llegar tarde: la llegada se puede marcar
# desde 30 minutos antes (`EARLY_CHECKIN_WINDOW`). Hasta el 2026-11-26 eran 15.
PUNCTUALITY_TOLERANCE = timedelta(minutes=5)

# Para que nadie se olvide de marcar: tres recordatorios, 10 minutos antes de
# la hora en que se espera a la persona, a esa hora y 5 minutos después. Con
# el segundo se le avisa también al comercio, que tiene la última palabra.
RECORDATORIOS_DE_LLEGADA = (
    timedelta(minutes=-10),
    timedelta(0),
    timedelta(minutes=5),
)
# El paso en el que también se le avisa al comercio (a la hora de inicio).
PASO_AVISO_AL_COMERCIO = 2
# Quien toma un turno reofrecido ya empezado (el reemplazo, U080) acaba de
# confirmar y está yendo: no tiene sentido avisarle «es la hora» en ese mismo
# momento ni alarmar al comercio. Le toca un solo recordatorio, a los 20
# minutos de confirmar (el de antes de la puntualidad real).
RECORDATORIO_AL_REEMPLAZO = timedelta(minutes=20)


def arrived_on_time(check_in_at: datetime | None, start_at: datetime) -> bool:
    """Puntual = marcó hasta 5 min después del inicio; antes, siempre.

    Sin check-in no hay llegada: no es puntual. Normaliza a "naive" (en
    SQLite los datetimes vuelven sin tzinfo; se asume UTC en ambos).
    """
    if check_in_at is None:
        return False
    return _naive(check_in_at) - _naive(start_at) <= PUNCTUALITY_TOLERANCE


def punctuality_of(
    check_in_at: datetime | None,
    start_at: datetime,
    taken_after_start: bool,
    arrival_on_time: bool | None = None,
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
    # La llegada la marcó el comercio («Ya llegó»): vale lo que dijo, a
    # horario o tarde. La hora en que lo tocó no es la hora en que llegó.
    if arrival_on_time is not None:
        return arrival_on_time
    return arrived_on_time(check_in_at, start_at)


def recordatorio_pendiente(
    expected_from: datetime,
    enviados: int,
    ahora: datetime,
    *,
    taken_after_start: bool = False,
) -> tuple[int | None, datetime | None]:
    """Qué recordatorio de llegada toca mandar ahora y cuándo volver a mirar.

    `enviados` es el último paso ya mandado (0 = ninguno). Devuelve
    `(paso, proxima)`: `paso` es el recordatorio a mandar (1, 2 o 3) o `None`;
    `proxima`, el momento del próximo. Si varios quedaron atrás se manda sólo
    el último: nadie recibe tres avisos juntos."""
    esperada = _naive(expected_from)
    ahora = _naive(ahora)
    if taken_after_start:
        # Un solo recordatorio, que vale por los tres.
        deltas = (RECORDATORIO_AL_REEMPLAZO,) * len(RECORDATORIOS_DE_LLEGADA)
    else:
        deltas = RECORDATORIOS_DE_LLEGADA
    momentos = [esperada + delta for delta in deltas]
    vencidos = sum(1 for m in momentos if m <= ahora)
    proxima = next((m for m in momentos if m > ahora), None)
    # Sin tope de tiempo propio: quien confirmó tarde o agarró al scheduler
    # caído recibe igual el último, hasta que la ausencia automática lo resuelva.
    if vencidos > enviados:
        return vencidos, proxima
    return None, proxima
