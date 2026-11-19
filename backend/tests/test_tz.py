"""Tests unitarios (sin DB) de `app.core.tz` — helper de fecha/hora en
horario de Argentina (ART, UTC-3). El servidor corre en UTC (Render):
estos tests fijan una hora "peligrosa" (23:30 ART = 02:30 UTC del día
siguiente) para verificar que `hoy_art()`/`now_art()` devuelven el día
ARGENTINO correcto y no el día UTC (ver `docs/BUGS.md`)."""

import datetime as dt_module

from app.core import tz


class _FixedDateTime(dt_module.datetime):
    """Subclase de `datetime` con `now()` fijo, para monkeypatchear
    `tz.datetime` sin depender de una librería externa (freezegun no está
    entre las dependencias del proyecto)."""

    _fixed_utc: dt_module.datetime

    @classmethod
    def now(cls, tz=None):  # noqa: A002 - firma compatible con datetime.now
        if tz is not None:
            return cls._fixed_utc.astimezone(tz)
        return cls._fixed_utc


def _freeze_utc(monkeypatch, utc_dt: dt_module.datetime) -> None:
    frozen = type("FrozenDateTime", (_FixedDateTime,), {"_fixed_utc": utc_dt})
    monkeypatch.setattr(tz, "datetime", frozen)


def test_hoy_art_23_30_art_del_21_es_02_30_utc_del_22(monkeypatch):
    # 23:30 del 21/07 en Argentina (UTC-3) = 02:30 UTC del 22/07.
    utc_dangerous_hour = dt_module.datetime(2026, 7, 22, 2, 30, tzinfo=dt_module.timezone.utc)
    _freeze_utc(monkeypatch, utc_dangerous_hour)

    assert tz.hoy_art() == dt_module.date(2026, 7, 21)


def test_now_art_conserva_la_hora_de_pared_argentina(monkeypatch):
    utc_dangerous_hour = dt_module.datetime(2026, 7, 22, 2, 30, tzinfo=dt_module.timezone.utc)
    _freeze_utc(monkeypatch, utc_dangerous_hour)

    now = tz.now_art()
    assert (now.year, now.month, now.day, now.hour, now.minute) == (2026, 7, 21, 23, 30)


def test_hoy_art_en_horario_diurno_coincide_con_utc(monkeypatch):
    # A mediodía UTC (09:00 ART) no hay ambigüedad: mismo día en ambos casos.
    utc_daytime = dt_module.datetime(2026, 7, 22, 12, 0, tzinfo=dt_module.timezone.utc)
    _freeze_utc(monkeypatch, utc_daytime)

    assert tz.hoy_art() == dt_module.date(2026, 7, 22)


# --- format_turno_art -------------------------------------------------------
# El mail de "te aceptaron" hacía `start_at.strftime(...)` sobre el datetime de
# la base, que está en UTC, y un turno de las 20:00 llegaba como "a las 23:00".


def test_un_turno_de_las_20_se_lee_a_las_20_y_no_a_las_23():
    # Domingo 27/09/2026 20:00 ART = 23:00 UTC; termina el lunes 02:00 ART.
    start = dt_module.datetime(2026, 9, 27, 23, 0, tzinfo=dt_module.timezone.utc)
    end = dt_module.datetime(2026, 9, 28, 5, 0, tzinfo=dt_module.timezone.utc)
    assert tz.format_turno_art(start, end) == "domingo 27/09, de 20:00 a 02:00"


def test_un_datetime_sin_zona_se_toma_como_utc():
    # SQLite (los tests) devuelve los datetimes sin zona; la base real, en UTC.
    start = dt_module.datetime(2026, 9, 27, 23, 0)
    end = dt_module.datetime(2026, 9, 28, 5, 0)
    assert tz.format_turno_art(start, end) == "domingo 27/09, de 20:00 a 02:00"


# --- format_duracion / format_desde_art (G9) --------------------------------


def test_duraciones_en_palabras():
    from datetime import timedelta

    f = tz.format_duracion
    assert f(timedelta(hours=2)) == "2 horas"
    assert f(timedelta(hours=1)) == "1 hora"
    assert f(timedelta(minutes=45)) == "45 minutos"
    assert f(timedelta(minutes=1)) == "1 minuto"
    assert f(timedelta(minutes=90)) == "1 hora y 30 minutos"
    assert f(timedelta(hours=26, minutes=5)) == "1 día, 2 horas y 5 minutos"
    assert f(timedelta(days=2)) == "2 días"
    assert f(timedelta(seconds=20)) == "1 minuto"  # redondea hacia arriba
    assert f(timedelta(0)) == "menos de un minuto"
    assert f(timedelta(minutes=-5)) == "menos de un minuto"


def test_desde_hoy_manana_y_dia_de_la_semana_en_hora_argentina():
    from datetime import timedelta

    utc = dt_module.timezone.utc
    ahora = dt_module.datetime(2026, 11, 13, 12, 0, tzinfo=utc)  # vie 09:00 ART
    f = tz.format_desde_art
    assert f(dt_module.datetime(2026, 11, 13, 16, 20, tzinfo=utc), ahora) == (
        "desde las 13:20 de hoy"
    )
    assert f(dt_module.datetime(2026, 11, 14, 16, 20, tzinfo=utc), ahora) == (
        "desde las 13:20 de mañana"
    )
    assert f(dt_module.datetime(2026, 11, 16, 16, 20, tzinfo=utc), ahora) == (
        "desde las 13:20 del lunes"
    )
    # A una semana o más, se agrega la fecha para que "viernes" no confunda.
    assert f(ahora + timedelta(days=7, hours=4, minutes=20), ahora) == (
        "desde las 13:20 del viernes 20/11"
    )


def test_desde_en_la_medianoche_argentina_cuenta_el_dia_argentino():
    utc = dt_module.timezone.utc
    # Viernes 22:00 ART = sábado 01:00 UTC: en UTC "hoy" ya sería sábado.
    ahora = dt_module.datetime(2026, 11, 14, 1, 0, tzinfo=utc)
    f = tz.format_desde_art
    # 00:00 ART del sábado = 03:00 UTC: es mañana para quien lo lee.
    assert f(dt_module.datetime(2026, 11, 14, 3, 0, tzinfo=utc), ahora) == (
        "desde las 00:00 de mañana"
    )
    # 23:59 ART del viernes = 02:59 UTC del sábado: sigue siendo hoy.
    assert f(dt_module.datetime(2026, 11, 14, 2, 59, tzinfo=utc), ahora) == (
        "desde las 23:59 de hoy"
    )


def test_desde_un_turno_que_cruza_al_dia_siguiente():
    utc = dt_module.timezone.utc
    ahora = dt_module.datetime(2026, 11, 13, 20, 0, tzinfo=utc)  # vie 17:00 ART
    # Turno del viernes 22:00 ART al sábado 03:00 ART: la llegada se habilita
    # 30 minutos antes del inicio (viernes 21:30 ART = sábado 00:30 UTC) y el
    # fin cae al día siguiente.
    inicio = dt_module.datetime(2026, 11, 14, 1, 0, tzinfo=utc)
    habilitado = inicio - dt_module.timedelta(minutes=30)
    assert tz.format_desde_art(habilitado, ahora) == "desde las 21:30 de hoy"
    fin = inicio + dt_module.timedelta(hours=5)
    assert tz.format_turno_art(inicio, fin) == "viernes 13/11, de 22:00 a 03:00"


def test_desde_acepta_datetime_sin_zona_como_utc():
    ahora = dt_module.datetime(2026, 11, 13, 12, 0)
    assert tz.format_desde_art(dt_module.datetime(2026, 11, 13, 16, 20), ahora) == (
        "desde las 13:20 de hoy"
    )
