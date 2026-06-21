"""Objetos de valor del dominio de turnos."""

from enum import Enum


class ShiftStatus(str, Enum):
    """Estados del turno — la línea de tiempo del "Modo Uber" del spec.

    El flujo nominal es:
        BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
        EN_CAMINO → CHECK_IN → TRABAJANDO → CHECK_OUT → FINALIZADO → PAGADO

    CANCELADO es alcanzable desde cualquier estado no terminal.
    """

    BORRADOR = "borrador"
    PUBLICADO = "publicado"
    BUSCANDO_PERSONAL = "buscando_personal"
    ASIGNADO = "asignado"
    CONFIRMADO = "confirmado"
    EN_CAMINO = "en_camino"
    CHECK_IN = "check_in"
    TRABAJANDO = "trabajando"
    CHECK_OUT = "check_out"
    FINALIZADO = "finalizado"
    PAGADO = "pagado"
    CANCELADO = "cancelado"


# Estados terminales: no admiten más transiciones.
TERMINAL_STATUSES: frozenset[ShiftStatus] = frozenset(
    {ShiftStatus.FINALIZADO, ShiftStatus.PAGADO, ShiftStatus.CANCELADO}
)

# Estados en los que el turno todavía puede editarse por el comercio.
EDITABLE_STATUSES: frozenset[ShiftStatus] = frozenset(
    {ShiftStatus.BORRADOR, ShiftStatus.PUBLICADO}
)

# Estados visibles en el feed público (para que los trabajadores se postulen).
OPEN_STATUSES: frozenset[ShiftStatus] = frozenset(
    {ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL}
)
