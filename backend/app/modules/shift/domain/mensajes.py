"""Textos de las acciones del turno que no se pueden hacer, para quien los lee.

Los lee una persona en la app (el trabajador o el comercio, según quién tocó
el botón), así que van en voseo, sin nombres de estados internos y sin
flechas. Se dicen por caso —según en qué punto está el turno— y en lo que le
sirve a esa persona: qué pasó o qué falta, no qué transición se intentó.

Sólo textos: cuándo se permite cada acción lo deciden las entidades. Sin
imports de afuera del dominio."""

from app.modules.shift.domain.value_objects import ShiftStatus as S

_GENERICO = "Esta acción ya no se puede hacer: el turno cambió. Actualizá la pantalla."

_TERMINO = "Este turno ya terminó."
_CANCELO_COMERCIO = "El comercio canceló este turno."
_CANCELASTE = "Ya cancelaste este turno."
_VENCIO = "Este turno venció sin cubrirse."
_SIN_NADIE = "Este turno no tiene a nadie asignado."

# Acción -> estado actual -> texto. Si el estado no está, se usa `_GENERICO`.
_TEXTOS: dict[str, dict[S, str]] = {
    "publicar": {
        S.PUBLICADO: "Este turno ya está publicado.",
        S.BUSCANDO_PERSONAL: "Este turno ya está publicado.",
        S.ASIGNADO: "Este turno ya está publicado.",
        S.CONFIRMADO: "Este turno ya está publicado.",
        S.EN_CAMINO: "Este turno ya está publicado.",
        S.CHECK_IN: "Este turno ya empezó.",
        S.TRABAJANDO: "Este turno ya empezó.",
        S.CHECK_OUT: _TERMINO,
        S.CANCELADO: "Cancelaste este turno, ya no se puede publicar.",
        S.NO_CUBIERTO: _VENCIO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
    },
    "buscar": {S.BORRADOR: "Publicá el turno para empezar a buscar personal."},
    "asignar": {
        S.BORRADOR: "Publicá el turno antes de elegir a alguien.",
        S.ASIGNADO: "Este turno ya tiene a alguien asignado.",
        S.CONFIRMADO: "Este turno ya tiene a alguien confirmado.",
        S.EN_CAMINO: "Este turno ya tiene a alguien confirmado.",
        S.CHECK_IN: "Este turno ya empezó.",
        S.TRABAJANDO: "Este turno ya empezó.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELASTE,
        S.NO_CUBIERTO: _VENCIO,
    },
    "confirmar": {
        S.CONFIRMADO: "Ya habías confirmado este turno.",
        S.EN_CAMINO: "Ya habías confirmado este turno.",
        S.CHECK_IN: "Ya habías confirmado este turno y ya marcaste tu llegada.",
        S.TRABAJANDO: "Ya habías confirmado este turno y ya marcaste tu llegada.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
        S.BUSCANDO_PERSONAL: "Este turno ya no está asignado a vos.",
        S.PUBLICADO: "Este turno ya no está asignado a vos.",
    },
    "rechazar": {
        S.CONFIRMADO: "Ya habías confirmado este turno. Si no podés ir, cancelá tu asignación.",
        S.EN_CAMINO: "Ya habías confirmado este turno. Si no podés ir, cancelá tu asignación.",
        S.CHECK_IN: "Ya marcaste tu llegada: este turno ya no se puede rechazar.",
        S.TRABAJANDO: "Ya marcaste tu llegada: este turno ya no se puede rechazar.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
        S.BUSCANDO_PERSONAL: "Este turno ya no está asignado a vos.",
        S.PUBLICADO: "Este turno ya no está asignado a vos.",
    },
    "cancelar": {
        S.CANCELADO: _CANCELASTE,
        S.NO_CUBIERTO: "Este turno venció sin cubrirse: no hace falta cancelarlo.",
        S.CHECK_OUT: "Este turno ya se trabajó, no se puede cancelar.",
        S.FINALIZADO: "Este turno ya se trabajó, no se puede cancelar.",
        S.PAGADO: "Este turno ya se trabajó y se pagó, no se puede cancelar.",
    },
    "cancelar_asistencia": {
        S.EN_CAMINO: "Ya avisaste que salís hacia el turno: si no podés ir, avisale al comercio.",
        S.ASIGNADO: "Todavía no confirmaste este turno: si no podés ir, rechazalo.",
        S.CHECK_IN: "Ya marcaste tu llegada: este turno ya no se puede cancelar.",
        S.TRABAJANDO: "Ya marcaste tu llegada: este turno ya no se puede cancelar.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
        S.BUSCANDO_PERSONAL: "Este turno ya no está asignado a vos.",
        S.PUBLICADO: "Este turno ya no está asignado a vos.",
    },
    "no_se_presento": {
        S.BORRADOR: _SIN_NADIE,
        S.PUBLICADO: _SIN_NADIE,
        S.BUSCANDO_PERSONAL: _SIN_NADIE,
        S.ASIGNADO: "Todavía no confirmó el turno, así que no puede faltar.",
        S.CHECK_IN: "El trabajador ya marcó su llegada.",
        S.TRABAJANDO: "El trabajador ya marcó su llegada.",
        S.CHECK_OUT: "El trabajador ya cumplió este turno.",
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELASTE,
        S.NO_CUBIERTO: _VENCIO,
    },
    "no_cubierto": {
        S.BORRADOR: "Este turno todavía no se publicó.",
        S.CONFIRMADO: "Este turno ya tiene a alguien confirmado.",
        S.EN_CAMINO: "Este turno ya tiene a alguien confirmado.",
        S.CHECK_IN: "Este turno ya empezó.",
        S.TRABAJANDO: "Este turno ya empezó.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: "Este turno está cancelado.",
        S.NO_CUBIERTO: _VENCIO,
    },
    "salir": {
        S.ASIGNADO: "Primero tenés que confirmar el turno.",
        S.EN_CAMINO: "Ya avisaste que salís hacia el turno.",
        S.CHECK_IN: "Ya marcaste tu llegada.",
        S.TRABAJANDO: "Ya marcaste tu llegada.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
    },
    "compartir_ubicacion": {
        S.ASIGNADO: "Primero tenés que confirmar el turno para compartir tu ubicación.",
        S.CHECK_IN: "Ya marcaste tu llegada: la ubicación de camino ya no se comparte.",
        S.TRABAJANDO: "Ya marcaste tu llegada: la ubicación de camino ya no se comparte.",
        S.CHECK_OUT: _TERMINO,
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
    },
    "llegada": {
        S.ASIGNADO: "Primero tenés que confirmar el turno.",
        S.CHECK_IN: "Ya marcaste tu llegada.",
        S.TRABAJANDO: "Ya marcaste tu llegada.",
        S.CHECK_OUT: "Ya marcaste tu salida: este turno ya terminó.",
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
    },
    "empezar": {
        S.ASIGNADO: "Primero tenés que confirmar el turno y marcar tu llegada.",
        S.CONFIRMADO: "Primero tenés que marcar tu llegada.",
        S.EN_CAMINO: "Primero tenés que marcar tu llegada.",
        S.TRABAJANDO: "Ya empezaste este turno.",
        S.CHECK_OUT: "Ya marcaste tu salida.",
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
    },
    "salida": {
        S.ASIGNADO: "Primero tenés que confirmar el turno y marcar tu llegada.",
        S.CONFIRMADO: "Primero tenés que marcar tu llegada.",
        S.EN_CAMINO: "Primero tenés que marcar tu llegada.",
        S.CHECK_OUT: "Ya marcaste tu salida.",
        S.FINALIZADO: _TERMINO,
        S.PAGADO: _TERMINO,
        S.CANCELADO: _CANCELO_COMERCIO,
        S.NO_CUBIERTO: _VENCIO,
    },
    "cerrar": {
        S.CONFIRMADO: "El trabajador todavía no marcó su llegada.",
        S.EN_CAMINO: "El trabajador todavía no marcó su llegada.",
        S.CHECK_IN: "El trabajador todavía no marcó su salida.",
        S.TRABAJANDO: "El trabajador todavía no marcó su salida.",
        S.FINALIZADO: "Este turno ya estaba cerrado.",
        S.PAGADO: "Este turno ya estaba cerrado y pagado.",
        S.CANCELADO: _CANCELASTE,
        S.NO_CUBIERTO: _VENCIO,
    },
    "pagar": {
        S.CHECK_OUT: "Primero tenés que cerrar el turno.",
        S.PAGADO: "Ya marcaste este turno como pagado.",
        S.CANCELADO: _CANCELASTE,
        S.NO_CUBIERTO: _VENCIO,
    },
}

_TODAVIA_NO_SE_TRABAJO = "Este turno todavía no se trabajó."
for _estado in (S.BORRADOR, S.PUBLICADO, S.BUSCANDO_PERSONAL, S.ASIGNADO, S.CONFIRMADO,
                S.EN_CAMINO, S.CHECK_IN, S.TRABAJANDO):
    _TEXTOS["pagar"].setdefault(_estado, _TODAVIA_NO_SE_TRABAJO)

# Acciones del trabajador: si el turno volvió a la búsqueda (o nunca tuvo a
# nadie), ya no es suyo.
_YA_NO_ES_TUYO = "Este turno ya no está asignado a vos."
for _accion in ("confirmar", "rechazar", "cancelar_asistencia", "salir",
                "compartir_ubicacion", "llegada", "empezar", "salida"):
    for _estado in (S.BORRADOR, S.PUBLICADO, S.BUSCANDO_PERSONAL):
        _TEXTOS[_accion].setdefault(_estado, _YA_NO_ES_TUYO)

# Acciones del comercio sobre un turno que todavía no llegó a esa etapa.
for _estado in (S.BORRADOR, S.PUBLICADO, S.BUSCANDO_PERSONAL, S.ASIGNADO):
    _TEXTOS["cerrar"].setdefault(_estado, "El trabajador todavía no trabajó este turno.")


def no_se_puede(accion: str, estado: S) -> str:
    """Texto para quien intentó `accion` con el turno en `estado`."""
    return _TEXTOS.get(accion, {}).get(estado, _GENERICO)
