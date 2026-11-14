"""Regla del horario de un turno NUEVO (G14, hallazgos U055, U056, U060).

Un turno se publica con el inicio por delante (con 5 minutos de tolerancia, por
el tiempo que lleva completar el formulario) y dura entre 1 y 16 horas
(decisión 15 de la salida a beta). El formulario aplica la misma regla
(`frontend/lib/turno-horario.ts`): si cambia una, cambia la otra.

Es una regla de ALTA y de cambio de fecha, no un invariante de la entidad: un
turno que ya existe (cargado de la base, en curso, de un evento viejo) puede
tener el inicio en el pasado o una duración fuera de rango sin dejar de ser un
turno válido. Por eso no vive en `Shift.__post_init__`, que corre en cada
lectura, sino acá, y la llaman sólo `ShiftService.create_shift` y
`update_shift` cuando se cambia el horario.
"""

from datetime import datetime, timedelta, timezone

from app.core.tz import now_art
from app.modules.shift.domain.exceptions import InvalidShiftScheduleError

TOLERANCIA_INICIO = timedelta(minutes=5)
DURACION_MINIMA = timedelta(hours=1)
DURACION_MAXIMA = timedelta(hours=16)


def _utc(value: datetime) -> datetime:
    """Aware -> UTC; sin zona se toma como UTC (igual que `app.core.dt.naive`)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def validar_horario_nuevo(
    start_at: datetime,
    end_at: datetime,
    now: datetime | None = None,
    *,
    validar_inicio: bool = True,
) -> None:
    """Levanta `InvalidShiftScheduleError` (con el texto para la persona) si el
    horario no sirve para un turno nuevo. Al editar, `validar_inicio=False`
    cuando el inicio no se tocó: un turno ya empezado sigue siendo editable en
    lo demás."""
    ahora = _utc(now if now is not None else now_art())
    inicio = _utc(start_at)
    fin = _utc(end_at)

    if fin <= inicio:
        raise InvalidShiftScheduleError("El turno tiene que terminar después de empezar.")
    if validar_inicio and inicio < ahora - TOLERANCIA_INICIO:
        raise InvalidShiftScheduleError(
            "El turno no puede empezar en el pasado. Elegí un inicio desde ahora en adelante."
        )
    duracion = fin - inicio
    if duracion < DURACION_MINIMA:
        raise InvalidShiftScheduleError("Un turno dura al menos 1 hora.")
    if duracion > DURACION_MAXIMA:
        raise InvalidShiftScheduleError(
            "Un turno dura hasta 16 horas. Para cubrir más tiempo, publicá dos turnos."
        )


def mismo_instante(a: datetime, b: datetime) -> bool:
    """Compara como instantes, no como texto: la base devuelve las fechas con o
    sin zona según el motor."""
    return _utc(a) == _utc(b)
