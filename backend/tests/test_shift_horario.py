"""G14 (U055, U056, U060): el horario de un turno nuevo.

El inicio no puede haber pasado (tolerancia de 5 minutos) y la duración va de 1
a 16 horas. La regla corre al crear y al cambiar el horario, no al leer ni al
operar sobre turnos que ya existen.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.modules.shift.domain.exceptions import InvalidShiftScheduleError
from app.modules.shift.domain.schedule import validar_horario_nuevo
from tests.conftest import auth_headers

pytestmark = [pytest.mark.asyncio, pytest.mark.regla_de_horario]

AHORA = datetime(2026, 11, 20, 15, 0, tzinfo=timezone.utc)


def _iso(value: datetime) -> str:
    return value.replace(tzinfo=None).isoformat()


def test_acepta_un_turno_que_empieza_ahora_y_dura_8_horas():
    validar_horario_nuevo(AHORA, AHORA + timedelta(hours=8), AHORA)


def test_tolera_cinco_minutos_de_inicio_pasado_pero_no_seis():
    validar_horario_nuevo(AHORA - timedelta(minutes=5), AHORA + timedelta(hours=3), AHORA)
    with pytest.raises(InvalidShiftScheduleError, match="en el pasado"):
        validar_horario_nuevo(
            AHORA - timedelta(minutes=6), AHORA + timedelta(hours=3), AHORA
        )


@pytest.mark.parametrize(
    ("horas", "ok"),
    [(0.5, False), (0.99, False), (1, True), (16, True), (16.01, False), (30, False)],
)
def test_duracion_entre_1_y_16_horas(horas: float, ok: bool):
    inicio = AHORA + timedelta(days=1)
    if ok:
        validar_horario_nuevo(inicio, inicio + timedelta(hours=horas), AHORA)
    else:
        with pytest.raises(InvalidShiftScheduleError):
            validar_horario_nuevo(inicio, inicio + timedelta(hours=horas), AHORA)


def test_fin_antes_del_inicio_se_rechaza_con_texto_de_persona():
    with pytest.raises(InvalidShiftScheduleError, match="terminar después de empezar"):
        validar_horario_nuevo(AHORA + timedelta(hours=5), AHORA + timedelta(hours=2), AHORA)


def test_al_editar_sin_tocar_el_inicio_no_se_exige_que_sea_futuro():
    inicio = AHORA - timedelta(hours=2)
    validar_horario_nuevo(inicio, inicio + timedelta(hours=8), AHORA, validar_inicio=False)


def test_compara_instantes_aunque_una_fecha_venga_sin_zona_o_en_hora_argentina():
    # 12:00 en Argentina (-03:00) es las 15:00 UTC: es "ahora", no el pasado.
    ahora_ar = datetime.fromisoformat("2026-11-20T12:00:00-03:00")
    validar_horario_nuevo(ahora_ar, ahora_ar + timedelta(hours=4), AHORA)
    sin_zona = datetime(2026, 11, 20, 15, 0)
    validar_horario_nuevo(sin_zona, sin_zona + timedelta(hours=4), AHORA)


async def _comercio(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


def _payload(start: datetime, hours: float = 8, **extra) -> dict:
    return {
        "position": "mozo",
        "quantity": 1,
        "start_at": _iso(start),
        "end_at": _iso(start + timedelta(hours=hours)),
        "pay_amount": "70000.00",
        "city": "Palermo",
        **extra,
    }


def _en(horas: float) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=horas)


async def test_crear_turno_con_inicio_pasado_da_400_en_castellano(client: AsyncClient):
    headers = await _comercio(client, "horario1@staffya.com")
    r = await client.post("/api/v1/shifts", headers=headers, json=_payload(_en(-3)))
    assert r.status_code == 400
    assert "no puede empezar en el pasado" in r.json()["detail"]


@pytest.mark.parametrize("horas", [0.5, 17, 30])
async def test_crear_turno_fuera_de_1_a_16_horas_da_400(client: AsyncClient, horas: float):
    headers = await _comercio(client, f"horario_dur_{int(horas * 10)}@staffya.com")
    r = await client.post("/api/v1/shifts", headers=headers, json=_payload(_en(2), horas))
    assert r.status_code == 400
    assert "Un turno dura" in r.json()["detail"]


async def test_crear_turno_de_16_horas_justas_es_valido(client: AsyncClient):
    headers = await _comercio(client, "horario16@staffya.com")
    r = await client.post("/api/v1/shifts", headers=headers, json=_payload(_en(2), 16))
    assert r.status_code == 201


async def test_editar_horario_aplica_la_regla_y_reenviar_el_mismo_no(client: AsyncClient):
    headers = await _comercio(client, "horario_put@staffya.com")
    inicio = _en(2)
    creado = await client.post("/api/v1/shifts", headers=headers, json=_payload(inicio))
    assert creado.status_code == 201
    shift_id = creado.json()["id"]

    # Mismo horario, otro pago: pasa.
    ok = await client.put(
        f"/api/v1/shifts/{shift_id}",
        headers=headers,
        json=_payload(inicio, pay_amount="80000.00"),
    )
    assert ok.status_code == 200

    # Mover el inicio al pasado: no.
    pasado = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=headers, json=_payload(_en(-5))
    )
    assert pasado.status_code == 400
    assert "en el pasado" in pasado.json()["detail"]

    # Alargar a 20 horas: no.
    largo = await client.put(
        f"/api/v1/shifts/{shift_id}", headers=headers, json=_payload(inicio, 20)
    )
    assert largo.status_code == 400
    assert "hasta 16 horas" in largo.json()["detail"]


async def test_editar_un_turno_con_inicio_ya_pasado_sin_tocar_el_horario(
    client: AsyncClient, session_factory
):
    """Un borrador cuyo inicio ya pasó (se publicó tarde, o es de antes de la
    regla) sigue siendo editable en lo demás: el horario no se vuelve a pedir."""
    from sqlalchemy import update

    from app.modules.shift.infrastructure.models import ShiftModel

    headers = await _comercio(client, "horario_viejo@staffya.com")
    inicio = _en(2)
    creado = await client.post("/api/v1/shifts", headers=headers, json=_payload(inicio))
    shift_id = creado.json()["id"]

    viejo = datetime.now(timezone.utc) - timedelta(days=2)
    async with session_factory() as session:
        await session.execute(
            update(ShiftModel)
            .where(ShiftModel.id == shift_id)
            .values(start_at=viejo, end_at=viejo + timedelta(hours=30))
        )
        await session.commit()

    r = await client.put(
        f"/api/v1/shifts/{shift_id}",
        headers=headers,
        json=_payload(viejo, 30, pay_amount="90000.00"),
    )
    assert r.status_code == 200, r.text


def _evento(start: datetime, hours: float = 6) -> dict:
    return {
        "name": "Boda Martínez",
        "start_at": _iso(start),
        "end_at": _iso(start + timedelta(hours=hours)),
        "city": "Palermo",
        "latitude": -34.58,
        "longitude": -58.43,
        "roles": [{"position": "mozo", "count": 2, "pay_amount": "50000.00"}],
    }


async def test_evento_con_inicio_pasado_o_demasiado_largo_da_400_y_no_crea_nada(
    client: AsyncClient,
):
    headers = await _comercio(client, "horario_evento@staffya.com")
    pasado = await client.post("/api/v1/shifts/events", headers=headers, json=_evento(_en(-4)))
    assert pasado.status_code == 400
    assert "en el pasado" in pasado.json()["detail"]
    largo = await client.post(
        "/api/v1/shifts/events", headers=headers, json=_evento(_en(3), 24)
    )
    assert largo.status_code == 400
    assert "hasta 16 horas" in largo.json()["detail"]

    ok = await client.post("/api/v1/shifts/events", headers=headers, json=_evento(_en(3)))
    assert ok.status_code == 201, ok.text
    assert len(ok.json()["shifts"]) == 2
