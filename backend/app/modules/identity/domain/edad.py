"""Edad mínima para usar Oído (U101, decisión de Julieta del 2026-11-17).

Los términos dicen que Oído es sólo para mayores de 18 años. Hasta este
cambio nadie lo comprobaba: el alta pide ahora la fecha de nacimiento y no
deja crear la cuenta a un menor. Regla pura, sin reloj propio: quien llama
pasa el día de hoy en hora argentina (`hoy_art()`), que es el que cuenta para
un cumpleaños.
"""

from datetime import date

from app.modules.identity.domain.exceptions import (
    BirthDateInvalidError,
    BirthDateRequiredError,
    UnderageError,
)

EDAD_MINIMA = 18
# Una fecha más vieja que esto es un error de tipeo (año 1095 por 1995), no
# una persona: se pide que la revise en vez de guardarla.
EDAD_MAXIMA = 100


def edad_en(nacimiento: date, hoy: date) -> int:
    """Años cumplidos a `hoy`. Quien nació un 29 de febrero los cumple el
    1 de marzo en los años que no son bisiestos."""
    return hoy.year - nacimiento.year - ((hoy.month, hoy.day) < (nacimiento.month, nacimiento.day))


def validar_fecha_nacimiento(nacimiento: date | None, hoy: date) -> date:
    """Devuelve la fecha si la persona puede crear una cuenta. Si no:
    `BirthDateRequiredError` (no vino), `BirthDateInvalidError` (futura o
    imposible) o `UnderageError` (menor de 18)."""
    if nacimiento is None:
        raise BirthDateRequiredError()
    if nacimiento > hoy or edad_en(nacimiento, hoy) > EDAD_MAXIMA:
        raise BirthDateInvalidError()
    if edad_en(nacimiento, hoy) < EDAD_MINIMA:
        raise UnderageError()
    return nacimiento
