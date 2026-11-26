"""Reconfirmación antes del turno (ADR-0031, P3). Reglas puras.

Entre que la persona confirma y el día del turno pueden pasar días. A las 24
y a las 3 horas del inicio se le pregunta si sigue yendo; si a las 2 horas no
contestó nunca, se le avisa al comercio. Nadie pierde el turno por no
contestar: decide el comercio.

Todo se calcula contra el inicio del turno, en UTC. Los textos de los avisos
(con `hoy`/`mañana` en hora argentina) los arma el caso de uso.
"""

from datetime import datetime, timedelta
from enum import Enum

from app.core.dt import naive
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.value_objects import ShiftStatus

PRIMER_AVISO = timedelta(hours=24)
SEGUNDO_AVISO = timedelta(hours=3)
ALERTA_AL_COMERCIO = timedelta(hours=2)

# «No puedo» contestado al primer aviso dentro de este rato cuenta como
# avisado con 24 horas: el aviso sale justo a las 24, así que sin este margen
# nadie llegaría a contestarlo a tiempo y avisar temprano no tendría premio.
MARGEN_PARA_CONTESTAR = timedelta(hours=3)


class PasoReconfirmacion(str, Enum):
    PRIMER_AVISO = "primer_aviso"
    SEGUNDO_AVISO = "segundo_aviso"
    ALERTA_AL_COMERCIO = "alerta_al_comercio"


def _ultima_afirmacion(shift: Shift) -> datetime | None:
    """La última vez que la persona dijo que va: al confirmar o al reconfirmar."""
    fechas = [naive(f) for f in (shift.confirmed_at, shift.reconfirmed_at) if f is not None]
    return max(fechas) if fechas else None


def paso_pendiente(
    shift: Shift, ahora: datetime
) -> tuple[PasoReconfirmacion | None, datetime | None]:
    """Qué le toca a este turno ahora y cuándo hay que volver a mirarlo.

    Devuelve `(paso, proxima)`: `paso` es lo que hay que mandar ya (o `None`)
    y `proxima`, el próximo momento en que puede tocarle algo (o `None` si ya
    no le toca nada)."""
    if shift.status != ShiftStatus.CONFIRMADO or shift.confirmed_at is None:
        return None, None
    ahora = naive(ahora)
    inicio = naive(shift.start_at)
    if ahora >= inicio:
        return None, None
    primer_aviso = inicio - PRIMER_AVISO
    segundo_aviso = inicio - SEGUNDO_AVISO
    alerta = inicio - ALERTA_AL_COMERCIO
    confirmo = naive(shift.confirmed_at)
    se_le_pregunto = (
        shift.reconfirm_24h_sent_at is not None or shift.reconfirm_3h_sent_at is not None
    )
    falta_alertar = (
        se_le_pregunto
        and shift.reconfirmed_at is None
        and shift.no_reconfirm_alert_sent_at is None
    )

    if ahora >= alerta:
        return (PasoReconfirmacion.ALERTA_AL_COMERCIO if falta_alertar else None), None

    if ahora >= segundo_aviso:
        # No se manda si confirmó o reconfirmó en las 3 horas anteriores al
        # aviso. Se mide contra la hora del aviso y no contra `ahora`: si no,
        # el aviso que se salteó a las 3 horas saldría un rato después.
        ultima = _ultima_afirmacion(shift)
        reciente = ultima is not None and ultima > segundo_aviso - SEGUNDO_AVISO
        if shift.reconfirm_3h_sent_at is None and not reciente:
            return PasoReconfirmacion.SEGUNDO_AVISO, alerta
        return None, (alerta if falta_alertar else None)

    if ahora >= primer_aviso:
        # No se manda si el turno se confirmó con menos de 24 horas.
        if shift.reconfirm_24h_sent_at is None and confirmo <= primer_aviso:
            return PasoReconfirmacion.PRIMER_AVISO, segundo_aviso
        return None, segundo_aviso

    return None, primer_aviso


def avisa_con_tiempo(
    inicio: datetime,
    primer_aviso_enviado: datetime | None,
    segundo_aviso_enviado: datetime | None,
    ahora: datetime,
) -> bool:
    """¿Cancelar ahora es avisar con tiempo? (ADR-0031, decisión 1.)

    Con 24 horas o más antes del inicio, o contestando el primer aviso dentro
    de `MARGEN_PARA_CONTESTAR`. Después del segundo aviso, no."""
    ahora = naive(ahora)
    inicio = naive(inicio)
    if ahora <= inicio - PRIMER_AVISO:
        return True
    if primer_aviso_enviado is None or segundo_aviso_enviado is not None:
        return False
    # El margen corre desde que salió el aviso, pero nunca más allá de las 21
    # horas antes del inicio: si el aviso salió tarde (el scheduler estuvo
    # caído), contestarlo no convierte una cancelación sobre la hora en una
    # avisada con tiempo.
    limite = min(
        naive(primer_aviso_enviado) + MARGEN_PARA_CONTESTAR,
        inicio - PRIMER_AVISO + MARGEN_PARA_CONTESTAR,
    )
    return ahora <= limite


def cancelacion_sin_peso(shift: Shift, ahora: datetime) -> bool:
    """¿Este «No puedo» se avisó con tiempo? Entonces la cancelación queda
    registrada pero no le suma al contador de cancelaciones de la persona."""
    return avisa_con_tiempo(
        shift.start_at, shift.reconfirm_24h_sent_at, shift.reconfirm_3h_sent_at, ahora
    )
