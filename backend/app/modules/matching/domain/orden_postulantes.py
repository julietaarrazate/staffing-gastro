"""Orden de los postulantes de un turno (ADR-0031, P2). Cálculo puro.

Hay dos carriles. En el **programado** manda que la persona calce: cada
criterio sólo desempata al anterior, y la distancia no entra. En el
**urgente** (lo marcó el comercio, o empieza en menos de 6 horas) el orden es
el de antes de P2, hasta que P4 defina el suyo.

En los dos, quien ya tuvo este turno y lo dejó va siempre al final (ADR-0026).
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
import math
from datetime import datetime, timedelta, timezone
from typing import TypeVar

# Un turno que empieza en menos de esto se trata como urgente aunque el
# comercio no lo haya marcado (ADR-0031, «Principio»).
VENTANA_URGENTE = timedelta(hours=6)

# El cumplimiento y la calificación se comparan por tramos (de a 10 puntos y
# de a una décima, que es lo que se muestra): con el número entero, una
# diferencia de milésimas decidiría el orden y los criterios de abajo
# (identidad verificada, quién se postuló antes) no desempatarían nunca.
_TRAMOS_POR_UNIDAD = 10

# Sin compromisos todavía: ni cumplió ni falló. Queda en el medio, para no
# esconder a quien recién llega ni ponerlo arriba de quien ya cumplió.
_CUMPLIMIENTO_NEUTRO = 0.5


@dataclass(frozen=True)
class SenalesPostulante:
    """Lo que el orden mira de cada postulante. Todo son datos que el comercio
    ya ve en la ficha de la persona, o que son suyos (favoritos, sus turnos)."""

    desasignada: bool
    es_favorito: bool
    trabajo_aca: bool
    ausencias: int
    turnos_en_el_puesto: int
    turnos_hechos: int
    cancelaciones: int
    puntualidad: float
    calificacion: float
    identidad_verificada: bool
    postulado_en: datetime | None


def _instante(dt: datetime) -> datetime:
    """El mismo instante, en UTC y sin zona, para comparar fechas que vienen
    con zona (Postgres, el reloj) con las que vienen sin ella (SQLite, ya en
    UTC). Una fecha con otra zona se convierte, no se le recorta el offset."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _acotar(valor: float, tope: float) -> float:
    return min(max(valor, 0.0), tope)


def _tramo(valor: float) -> int:
    # Medio tramo hacia arriba, siempre (`round` redondea al par).
    return math.floor(valor * _TRAMOS_POR_UNIDAD + 0.5)


def es_carril_urgente(urgent: bool, start_at: datetime, ahora: datetime) -> bool:
    """¿El turno va por el carril urgente? Lo marcó el comercio (o la
    escalada), o empieza en menos de 6 horas."""
    return urgent or _instante(start_at) - _instante(ahora) < VENTANA_URGENTE


def cumplimiento(senales: SenalesPostulante) -> float:
    """De 0 a 1: qué parte de sus compromisos terminó, por su puntualidad.
    Sin compromisos, neutro."""
    compromisos = senales.turnos_hechos + senales.cancelaciones
    if compromisos == 0:
        return _CUMPLIMIENTO_NEUTRO
    if senales.turnos_hechos == 0:
        return 0.0
    cumplidos = senales.turnos_hechos / compromisos
    return cumplidos * _acotar(senales.puntualidad, 1.0)


def calificacion_respaldada(senales: SenalesPostulante) -> float:
    """La calificación sólo cuenta si hay turnos hechos que la respalden."""
    return _acotar(senales.calificacion, 5.0) if senales.turnos_hechos > 0 else 0.0


def es_nuevo_verificado(senales: SenalesPostulante) -> bool:
    """Sello «Nuevo en Oído · identidad verificada»: sin turnos hechos, con la
    identidad verificada y sin ausencias."""
    return (
        senales.turnos_hechos == 0
        and senales.identidad_verificada
        and senales.ausencias == 0
    )


def _antiguedad(senales: SenalesPostulante) -> tuple[bool, datetime]:
    # Quien se postuló antes va primero; sin fecha, al final.
    if senales.postulado_en is None:
        return (True, datetime.min)
    return (False, _instante(senales.postulado_en))


def clave_programado(senales: SenalesPostulante) -> tuple:
    """Clave de orden del carril programado (menor va primero)."""
    return (
        senales.desasignada,
        not (senales.es_favorito or senales.trabajo_aca),
        senales.ausencias > 0,
        -senales.turnos_en_el_puesto,
        -_tramo(cumplimiento(senales)),
        -_tramo(calificacion_respaldada(senales)),
        not senales.identidad_verificada,
        _antiguedad(senales),
    )


def clave_urgente(senales: SenalesPostulante) -> tuple:
    """Clave de orden del carril urgente: la de antes de P2 (primero quien
    tiene turnos hechos; después calificación, puntualidad y cantidad)."""
    return (
        senales.desasignada,
        senales.turnos_hechos == 0,
        -_acotar(senales.calificacion, 5.0),
        -_acotar(senales.puntualidad, 1.0),
        -senales.turnos_hechos,
        _antiguedad(senales),
    )


T = TypeVar("T")


def ordenar_postulantes(
    postulantes: Sequence[T],
    senales_de: Callable[[T], SenalesPostulante],
    *,
    urgente: bool,
) -> list[T]:
    """Ordena los postulantes de un turno según su carril."""
    clave = clave_urgente if urgente else clave_programado
    return sorted(postulantes, key=lambda p: clave(senales_de(p)))
