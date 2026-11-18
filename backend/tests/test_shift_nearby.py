"""Dónde queda un turno a la hora de medir «cerca» (dominio puro).

`zone_of` es el único lugar que decide desde dónde se mide un turno; lo usan
el aviso a los trabajadores, los recomendados del comercio y el feed. Lo que
cruza la API está en `test_cerca_es_cerca.py`.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.nearby import (
    FeedOrigin,
    Zone,
    closest_first,
    is_nearby,
    zone_of,
)
from app.modules.worker.domain.value_objects import WorkerSkill

PALERMO = (-34.5800, -58.4300)
CORDOBA = (-31.4201, -64.1888)
LOCAL = Zone(latitude=PALERMO[0], longitude=PALERMO[1], city="Palermo")


def _shift(*, at: tuple[float, float] | None = None, city: str | None = None, **extra) -> Shift:
    start = datetime.now(timezone.utc) + timedelta(hours=2)
    return Shift(
        company_id=extra.pop("company_id", uuid4()),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=start,
        end_at=start + timedelta(hours=6),
        pay_amount=Decimal("70000"),
        latitude=at[0] if at else None,
        longitude=at[1] if at else None,
        city=city,
        **extra,
    )


def test_el_turno_con_coordenadas_se_mide_desde_su_zona():
    shift = _shift(at=CORDOBA, city="Córdoba")
    assert zone_of(shift, LOCAL) == Zone(CORDOBA[0], CORDOBA[1], "Córdoba")


def test_el_turno_con_ciudad_y_sin_coordenadas_se_mide_por_su_ciudad():
    """Aunque el local quede en otra parte: es un turno fuera del local."""
    shift = _shift(city="Córdoba")
    assert zone_of(shift, LOCAL) == Zone(None, None, "Córdoba")


def test_el_turno_sin_zona_se_mide_desde_el_local():
    assert zone_of(_shift(), LOCAL) == LOCAL


def test_una_ciudad_en_blanco_no_cuenta_como_zona():
    assert zone_of(_shift(city="   "), LOCAL) == LOCAL


def test_media_coordenada_no_cuenta_como_zona():
    shift = _shift()
    shift.latitude = PALERMO[0]  # sin longitud no hay punto
    assert zone_of(shift, LOCAL) == LOCAL


def test_sin_zona_y_sin_local_no_hay_desde_donde_medir():
    assert not zone_of(_shift()).is_known
    assert not zone_of(_shift(), Zone()).is_known


def test_un_turno_sin_zona_esta_cerca_si_lo_esta_el_local():
    shift = _shift()
    locals_ = {shift.company_id: LOCAL}
    en_palermo = FeedOrigin(latitude=PALERMO[0], longitude=PALERMO[1])
    en_cordoba = FeedOrigin(latitude=CORDOBA[0], longitude=CORDOBA[1])

    assert is_nearby(shift, en_palermo, 40.0, locals_)
    assert not is_nearby(shift, en_cordoba, 40.0, locals_)
    # Sin el local a mano no se puede ubicar: no es «cerca» de nadie.
    assert not is_nearby(shift, en_palermo, 40.0)


def test_un_turno_sin_zona_se_ordena_por_la_distancia_al_local():
    sin_zona = _shift()
    a_20_km = _shift(at=(PALERMO[0] + 20 / 111.19, PALERMO[1]), city="Palermo")
    origin = FeedOrigin(latitude=PALERMO[0], longitude=PALERMO[1])

    ordered = closest_first([a_20_km, sin_zona], origin, {sin_zona.company_id: LOCAL})

    assert ordered == [sin_zona, a_20_km]
    # Sin el local, lo que no se puede medir va al final.
    assert closest_first([sin_zona, a_20_km], origin) == [a_20_km, sin_zona]
