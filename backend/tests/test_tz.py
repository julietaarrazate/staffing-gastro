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
