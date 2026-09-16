"""Objetos de valor del dominio de turnos."""

from enum import Enum


class ShiftStatus(str, Enum):
    """Estados del turno — la línea de tiempo del "Modo Uber" del spec.

    El flujo nominal (ADR-0008, 2 pasos de asistencia en vez de 4) es:
        BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
        CHECK_IN → CHECK_OUT → FINALIZADO → PAGADO

    EN_CAMINO/TRABAJANDO siguen existiendo como estados válidos (turnos
    creados antes de ADR-0008 pueden seguir de largo por ahí,
    `Shift.check_in()`/`check_out()` los aceptan también), pero el flujo
    nuevo los saltea: `check_in()` va directo desde CONFIRMADO,
    `check_out()` directo desde CHECK_IN.

    CANCELADO es alcanzable desde cualquier estado no terminal (acción del
    comercio o del trabajador).

    NO_CUBIERTO (ADR-0015) es distinto: automático, del sistema, nunca de una
    persona. Se llega desde PUBLICADO/BUSCANDO_PERSONAL/ASIGNADO cuando pasa
    un período de gracia después de `start_at` sin que el turno haya llegado
    a CONFIRMADO — nadie decidió cancelar nada, simplemente el tiempo se
    agotó sin que la posición se cubriera (de ahí el nombre, tomado de la
    misión del producto: "cubrir una posición eventual"). Sin impacto de
    reputación: a diferencia de un no-show, nadie llegó a comprometerse.
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
    NO_CUBIERTO = "no_cubierto"


# Estados terminales: no admiten más transiciones.
TERMINAL_STATUSES: frozenset[ShiftStatus] = frozenset(
    {
        ShiftStatus.FINALIZADO,
        ShiftStatus.PAGADO,
        ShiftStatus.CANCELADO,
        ShiftStatus.NO_CUBIERTO,
    }
)

# Estados en los que el turno todavía puede editarse por el comercio.
EDITABLE_STATUSES: frozenset[ShiftStatus] = frozenset(
    {ShiftStatus.BORRADOR, ShiftStatus.PUBLICADO}
)

# Estados visibles en el feed público (para que los trabajadores se postulen).
OPEN_STATUSES: frozenset[ShiftStatus] = frozenset(
    {ShiftStatus.PUBLICADO, ShiftStatus.BUSCANDO_PERSONAL}
)

# Estados en los que un trabajador ya está "comprometido" con el turno (ya
# confirmó su asistencia o está en pleno ciclo de trabajo). Se usan para la
# regla de doble turno: un trabajador no puede CONFIRMAR un turno cuyo
# horario se solape con otro turno propio que ya esté en alguno de estos
# estados (ver `Shift.confirm` y `ShiftService.confirm_assignment`).
COMMITTED_STATUSES: frozenset[ShiftStatus] = frozenset(
    {
        ShiftStatus.CONFIRMADO,
        ShiftStatus.EN_CAMINO,
        ShiftStatus.CHECK_IN,
        ShiftStatus.TRABAJANDO,
        ShiftStatus.CHECK_OUT,
    }
)

# Estados desde los que el sistema puede resolver el turno como NO_CUBIERTO
# (ADR-0015) cuando se agota el período de gracia después de `start_at` sin
# llegar a CONFIRMADO. CONFIRMADO en adelante queda afuera a propósito: ahí
# ya hay a alguien comprometido, y lo que puede fallar de ahí en más es un
# no-show (`Shift.no_show()`), no una falta de cobertura.
UNCOVERED_ELIGIBLE_STATUSES: frozenset[ShiftStatus] = frozenset(
    {
        ShiftStatus.PUBLICADO,
        ShiftStatus.BUSCANDO_PERSONAL,
        ShiftStatus.ASIGNADO,
    }
)
