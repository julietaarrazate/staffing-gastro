"""Test unitario (sin DB) de `WorkerProfile.age` — usa `hoy_art()` (fecha de
negocio en Argentina), no `date.today()` (UTC en Render). Fija una hora
peligrosa (23:30 ART = 02:30 UTC del día siguiente) para probar que el
cumpleaños no se adelanta un día por el corte de medianoche en UTC en vez
de en Argentina (ver Fix TZ / `docs/BUGS.md`)."""

from datetime import date
from uuid import uuid4

from app.modules.worker.domain import entities as worker_entities
from app.modules.worker.domain.entities import WorkerProfile


def test_age_usa_la_fecha_argentina_no_la_utc(monkeypatch):
    # "Hoy" en Argentina es 21/07/2026 (23:30 ART), aunque en UTC ya sea
    # 22/07/2026 (02:30 UTC). El trabajador nació el 21/07/2000: si el
    # cálculo usara la fecha UTC (22/07), ya cumpliría años (26); con la
    # fecha argentina correcta (21/07) todavía le falta un día (25).
    monkeypatch.setattr(worker_entities, "hoy_art", lambda: date(2026, 7, 21))

    profile = WorkerProfile(user_id=uuid4(), birth_date=date(2000, 7, 21))

    assert profile.age == 26


def test_age_no_adelanta_el_cumpleanos_por_el_dia_utc(monkeypatch):
    # Mismo escenario, pero el cumpleaños es al día siguiente (22/07): en
    # fecha argentina real todavía no cumplió años.
    monkeypatch.setattr(worker_entities, "hoy_art", lambda: date(2026, 7, 21))

    profile = WorkerProfile(user_id=uuid4(), birth_date=date(2000, 7, 22))

    assert profile.age == 25


def test_age_none_sin_fecha_de_nacimiento():
    profile = WorkerProfile(user_id=uuid4())
    assert profile.age is None
