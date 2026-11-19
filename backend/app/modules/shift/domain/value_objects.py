"""Objetos de valor del dominio de turnos."""

from dataclasses import dataclass
from enum import Enum


class ShiftStatus(str, Enum):
    """Estados del turno — la línea de tiempo del ciclo de vida del turno.

    El flujo nominal (ADR-0008, 2 pasos de asistencia en vez de 4) es:
        BORRADOR → PUBLICADO → BUSCANDO_PERSONAL → ASIGNADO → CONFIRMADO →
        CHECK_IN → CHECK_OUT → FINALIZADO → PAGADO

    EN_CAMINO/TRABAJANDO siguen existiendo como estados válidos (turnos
    creados antes de ADR-0008 pueden seguir de largo por ahí,
    `Shift.check_in()`/`check_out()` los aceptan también), pero el flujo
    nuevo los saltea: `check_in()` va directo desde CONFIRMADO,
    `check_out()` directo desde CHECK_IN.

    CANCELADO es alcanzable desde cualquier estado no terminal (acción del
    comercio), salvo CHECK_OUT: con la salida marcada el turno ya se trabajó
    y se finaliza y se paga (U081, `NOT_CANCELLABLE_STATUSES`).

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

# Estados desde los que el comercio ya no puede cancelar: los terminales y,
# desde U081 (ADR-0007, actualización 2026-11-18), el turno con la salida
# marcada. Ese turno ya se trabajó: se finaliza y se paga.
NOT_CANCELLABLE_STATUSES: frozenset[ShiftStatus] = TERMINAL_STATUSES | {ShiftStatus.CHECK_OUT}

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

# Turnos con alguien asignado o confirmado que todavía no empezaron (nadie
# marcó la llegada). Son los que toca la suspensión de una cuenta (ADR-0024):
# si se suspende el comercio, se cancelan; si se suspende el trabajador, se
# reabren. EN_CAMINO («salí») cuenta como no empezado: la llegada no está
# marcada. CHECK_IN en adelante ya empezó y no se toca.
TAKEN_NOT_STARTED_STATUSES: frozenset[ShiftStatus] = frozenset(
    {
        ShiftStatus.ASIGNADO,
        ShiftStatus.CONFIRMADO,
        ShiftStatus.EN_CAMINO,
    }
)


# Estados de un turno empezado que la admin puede cerrar en nombre de una
# cuenta suspendida (decisión 21, ADR-0024): con la llegada marcada falta la
# salida; con la salida marcada falta cerrarlo.
ADMIN_CHECK_OUT_STATUSES: frozenset[ShiftStatus] = frozenset(
    {ShiftStatus.CHECK_IN, ShiftStatus.TRABAJANDO}
)


@dataclass(frozen=True)
class AdminClosePlan:
    """Qué hace «Cerrar turno» de la admin sobre un turno empezado de una
    cuenta suspendida (decisión 21, ADR-0024). Lo decide
    `Shift.admin_close_plan`; lo lee la ficha de la admin antes de confirmar.

    - `check_out`: marca la salida en nombre del trabajador suspendido.
    - `finish`: cierra el turno en nombre del comercio suspendido.
    - `worker_active` / `company_active`: cómo estaban las cuentas al decidir.
      `notifies` es a quién le llega el aviso al celular (la parte activa);
      a una cuenta suspendida el aviso le queda guardado, sin push."""

    check_out: bool
    finish: bool
    worker_active: bool
    company_active: bool

    @property
    def notifies(self) -> str | None:
        """A quién se le avisa: `"company"` si se marcó la salida y el
        comercio tiene que cerrar, `"worker"` si se cerró y el trabajador
        puede calificar, `None` si las dos cuentas están suspendidas."""
        if self.finish:
            return "worker" if self.worker_active else None
        return "company" if self.company_active else None
