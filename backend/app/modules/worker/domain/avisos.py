"""Tope a las cancelaciones con aviso que no pesan (2026-11-26).

Avisar con tiempo que no se va a un turno confirmado no suma una cancelación
(ADR-0031, decisión 1). Sin tope, alguien podía confirmar y soltar turnos
todo el tiempo sin costo. La regla: dos avisos sin peso por período de 30
días; desde el tercero dentro del mismo período, cuentan como cualquier
cancelación. El período arranca con el primer aviso y se renueva solo.
"""

from datetime import datetime, timedelta

AVISOS_SIN_PESO_POR_PERIODO = 2
PERIODO_DE_AVISOS = timedelta(days=30)


def _instante(momento: datetime, referencia: datetime) -> datetime:
    """SQLite devuelve la fecha sin zona: se lee con la de `referencia`."""
    if momento.tzinfo is None and referencia.tzinfo is not None:
        return momento.replace(tzinfo=referencia.tzinfo)
    return momento


def periodo_vigente(desde: datetime | None, ahora: datetime) -> bool:
    return desde is not None and ahora - _instante(desde, ahora) < PERIODO_DE_AVISOS


def avisos_usados(desde: datetime | None, usados: int, ahora: datetime) -> int:
    """Cuántos avisos sin peso lleva gastados en el período en curso."""
    return usados if periodo_vigente(desde, ahora) else 0


def queda_aviso_sin_peso(desde: datetime | None, usados: int, ahora: datetime) -> bool:
    return avisos_usados(desde, usados, ahora) < AVISOS_SIN_PESO_POR_PERIODO


def usar_aviso(
    desde: datetime | None, usados: int, ahora: datetime
) -> tuple[bool, datetime | None, int]:
    """Gasta un aviso sin peso si queda alguno. Devuelve `(sin_peso, desde,
    usados)` con el estado nuevo; si no quedaba, el estado no cambia."""
    if not queda_aviso_sin_peso(desde, usados, ahora):
        return False, desde, usados
    if periodo_vigente(desde, ahora):
        return True, desde, usados + 1
    return True, ahora, 1
