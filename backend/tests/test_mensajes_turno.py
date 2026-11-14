"""Los errores del turno los lee una persona (G9, U028/U029): hora argentina,
duraciones en palabras, cada caso con su texto, nada de nombres internos."""

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.modules.shift.domain.entities import (
    EARLY_CHECKIN_WINDOW,
    EN_ROUTE_WINDOW,
    Shift,
)
from app.modules.shift.domain.exceptions import (
    InvalidShiftTransitionError,
    ShiftError,
    WorkerTooFarFromShiftError,
)
from app.modules.shift.domain.mensajes import _GENERICO
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.domain.value_objects import WorkerSkill

ISO = re.compile(r"\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|\d\dT\d\d|\+00:00")
# "asignado", "publicado" o "cancelado" son castellano de todos los días; lo
# que delata un estado interno es el identificador (con guion bajo) o el verbo
# técnico de la transición.
NOMBRES_INTERNOS = re.compile(
    "|".join(
        [s.value for s in ShiftStatus if "_" in s.value]
        + [r"\bno-show\b", r"\btransici[oó]n\b", r"\bestado\b"]
    ),
    re.IGNORECASE,
)


def _turno(status: ShiftStatus, start_at: datetime | None = None) -> Shift:
    inicio = start_at or datetime.now(timezone.utc) + timedelta(days=3)
    return Shift(
        id=uuid4(),
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=inicio,
        end_at=inicio + timedelta(hours=5),
        pay_amount=Decimal("1000"),
        status=status,
        worker_profile_id=uuid4(),
    )


ACCIONES = {
    "publish": lambda t: t.publish(),
    "start_searching": lambda t: t.start_searching(),
    "assign": lambda t: t.assign(uuid4()),
    "confirm": lambda t: t.confirm(),
    "reject": lambda t: t.reject(),
    "cancel": lambda t: t.cancel(),
    "worker_cancel": lambda t: t.worker_cancel(),
    "no_show": lambda t: t.no_show(t.start_at + timedelta(hours=1)),
    "mark_not_covered": lambda t: t.mark_not_covered(),
    "depart": lambda t: t.depart(),
    "report_en_route_location": lambda t: t.report_en_route_location(-34.5, -58.4),
    "check_in": lambda t: t.check_in(-34.5, -58.4),
    "start_working": lambda t: t.start_working(),
    "check_out": lambda t: t.check_out(-34.5, -58.4),
    "finish": lambda t: t.finish(),
    "mark_paid": lambda t: t.mark_paid(),
}


def _assert_castellano_de_persona(mensaje: str) -> None:
    assert mensaje
    assert not ISO.search(mensaje), mensaje
    assert "→" not in mensaje and "->" not in mensaje, mensaje
    assert not NOMBRES_INTERNOS.search(mensaje), mensaje
    assert "_" not in mensaje, mensaje
    assert "ShiftStatus" not in mensaje and "timedelta" not in mensaje, mensaje
    assert mensaje[0].isupper(), mensaje


@pytest.mark.parametrize("accion", ACCIONES)
@pytest.mark.parametrize("estado", list(ShiftStatus))
def test_toda_transicion_invalida_se_dice_en_castellano_de_persona(accion, estado):
    turno = _turno(estado)
    try:
        ACCIONES[accion](turno)
    except InvalidShiftTransitionError as exc:
        mensaje = str(exc)
        _assert_castellano_de_persona(mensaje)
        # Cada caso tiene su texto: el genérico es sólo la red de seguridad.
        # (`start_searching` sólo lo dispara el sistema, tras publicar.)
        if accion != "start_searching":
            assert mensaje != _GENERICO, (accion, estado)
    except ShiftError as exc:  # p. ej. demasiado temprano / lejos: otro test
        _assert_castellano_de_persona(str(exc))


def test_mensajes_concretos_por_caso():
    t = _turno(ShiftStatus.CANCELADO)
    with pytest.raises(InvalidShiftTransitionError) as e:
        t.confirm()
    assert str(e.value) == "El comercio canceló este turno."

    t = _turno(ShiftStatus.CONFIRMADO)
    with pytest.raises(InvalidShiftTransitionError) as e:
        t.confirm()
    assert str(e.value) == "Ya habías confirmado este turno."

    t = _turno(ShiftStatus.CANCELADO)
    with pytest.raises(InvalidShiftTransitionError) as e:
        t.cancel()
    assert str(e.value) == "Ya cancelaste este turno."

    t = _turno(ShiftStatus.CHECK_IN)
    with pytest.raises(InvalidShiftTransitionError) as e:
        t.finish()
    assert str(e.value) == "El trabajador todavía no marcó su salida."


def test_llegada_antes_de_hora_dice_desde_cuando_en_hora_argentina():
    # `check_in` usa el reloj real: el turno arranca siempre dentro de 3 días.
    turno = _turno(ShiftStatus.CONFIRMADO)
    with pytest.raises(InvalidShiftTransitionError) as e:
        turno.check_in(-34.5, -58.4)
    mensaje = str(e.value)
    _assert_castellano_de_persona(mensaje)
    assert "se habilita desde las " in mensaje
    assert "30 minutos antes de que empiece el turno" in mensaje
    habilitado = (turno.start_at - EARLY_CHECKIN_WINDOW).astimezone(
        timezone(timedelta(hours=-3))
    )
    assert f"desde las {habilitado:%H:%M} del " in mensaje


def test_ubicacion_de_camino_antes_de_hora_dice_duracion_en_palabras():
    turno = _turno(ShiftStatus.CONFIRMADO)
    with pytest.raises(InvalidShiftTransitionError) as e:
        turno.report_en_route_location(-34.5, -58.4)
    mensaje = str(e.value)
    _assert_castellano_de_persona(mensaje)
    assert "2 horas antes de que empiece" in mensaje
    assert str(EN_ROUTE_WINDOW) not in mensaje  # "2:00:00"


def test_no_show_antes_de_hora_no_tiene_iso_ni_horas_utc():
    # 20:00 ART del viernes 13/11/2026.
    inicio = datetime(2026, 11, 13, 23, 0, tzinfo=timezone.utc)
    turno = _turno(ShiftStatus.CONFIRMADO, inicio)
    ahora = datetime(2026, 11, 13, 22, 50, tzinfo=timezone.utc)  # 19:50 ART
    with pytest.raises(InvalidShiftTransitionError) as e:
        turno.no_show(ahora)
    mensaje = str(e.value)
    _assert_castellano_de_persona(mensaje)
    assert mensaje == (
        "Todavía no podés marcar que no se presentó: se habilita desde las "
        "20:15 de hoy, 15 minutos después de que empieza el turno."
    )


def test_no_show_de_un_turno_de_madrugada_dice_el_dia_argentino():
    # 00:30 ART del sábado 14/11 = 03:30 UTC del sábado. Visto el viernes a las
    # 22:00 ART (01:00 UTC del sábado): en UTC "hoy" ya es sábado.
    inicio = datetime(2026, 11, 14, 3, 30, tzinfo=timezone.utc)
    turno = _turno(ShiftStatus.CONFIRMADO, inicio)
    with pytest.raises(InvalidShiftTransitionError) as e:
        turno.no_show(datetime(2026, 11, 14, 1, 0, tzinfo=timezone.utc))
    assert "desde las 00:45 de mañana" in str(e.value)


def test_demasiado_lejos_dice_metros_en_palabras():
    turno = _turno(ShiftStatus.CONFIRMADO, datetime.now(timezone.utc))
    turno.latitude = -34.60
    turno.longitude = -58.38
    with pytest.raises(WorkerTooFarFromShiftError) as e:
        turno.check_in(-34.61, -58.38)
    mensaje = str(e.value)
    assert "metros" in mensaje and " m)" not in mensaje
    _assert_castellano_de_persona(mensaje)
