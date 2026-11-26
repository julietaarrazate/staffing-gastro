"""Orden de los postulantes y recomendados por carril (ADR-0031, P2).

Primero el dominio puro (`matching/domain/orden_postulantes.py`), después la
API: la lista de postulantes llega ordenada y con los datos que explican el
orden, y los recomendados de un turno programado no premian la cercanía.
"""

from dataclasses import replace
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.modules.matching.domain.orden_postulantes import (
    SenalesPostulante,
    cumplimiento,
    es_carril_urgente,
    es_nuevo_verificado,
    ordenar_postulantes,
)
from app.modules.matching.domain.value_objects import (
    DEFAULT_WEIGHTS,
    PROGRAMADO_WEIGHTS,
)
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.infrastructure.models import WorkerProfileModel
from tests.conftest import auth_headers

AHORA = datetime(2026, 6, 20, 12, 0, tzinfo=timezone.utc)


def _senales(**cambios) -> SenalesPostulante:
    """Una persona sin nada: sin historial, sin verificar, sin vínculo."""
    base = SenalesPostulante(
        desasignada=False,
        es_favorito=False,
        trabajo_aca=False,
        ausencias=0,
        turnos_en_el_puesto=0,
        turnos_hechos=0,
        cancelaciones=0,
        puntualidad=0.0,
        calificacion=0.0,
        identidad_verificada=False,
        postulado_en=AHORA,
    )
    return replace(base, **cambios)


def _orden(personas: dict[str, SenalesPostulante], *, urgente: bool = False) -> list[str]:
    return ordenar_postulantes(list(personas), lambda n: personas[n], urgente=urgente)


# --- Dominio: carril programado ---------------------------------------------


def test_la_confianza_del_local_va_antes_que_cualquier_historial():
    personas = {
        "estrella": _senales(
            turnos_hechos=40, turnos_en_el_puesto=40, puntualidad=1.0, calificacion=5.0
        ),
        "favorita": _senales(es_favorito=True),
        "trabajo_aca": _senales(trabajo_aca=True, postulado_en=AHORA + timedelta(minutes=1)),
    }
    assert _orden(personas) == ["favorita", "trabajo_aca", "estrella"]


def test_una_ausencia_baja_aunque_tenga_buena_calificacion():
    personas = {
        "con_ausencia": _senales(
            ausencias=1, turnos_hechos=30, turnos_en_el_puesto=30,
            puntualidad=1.0, calificacion=5.0,
        ),
        "sin_faltas": _senales(
            turnos_hechos=2, turnos_en_el_puesto=1, puntualidad=0.8, calificacion=4.0
        ),
    }
    assert _orden(personas) == ["sin_faltas", "con_ausencia"]


def test_la_experiencia_que_cuenta_es_la_del_puesto():
    personas = {
        "otro_puesto": _senales(
            turnos_hechos=50, turnos_en_el_puesto=0, puntualidad=1.0, calificacion=5.0
        ),
        "este_puesto": _senales(
            turnos_hechos=3, turnos_en_el_puesto=3, puntualidad=0.9, calificacion=4.2
        ),
    }
    assert _orden(personas) == ["este_puesto", "otro_puesto"]


def test_cumplimiento_desempata_y_despues_la_calificacion():
    base = dict(turnos_hechos=10, turnos_en_el_puesto=5)
    personas = {
        "cancela": _senales(**base, cancelaciones=10, puntualidad=1.0, calificacion=5.0),
        "cumple": _senales(**base, puntualidad=1.0, calificacion=4.0),
        "cumple_mejor_valorada": _senales(**base, puntualidad=1.0, calificacion=4.6),
    }
    assert _orden(personas) == ["cumple_mejor_valorada", "cumple", "cancela"]


def test_una_diferencia_minima_de_cumplimiento_no_tapa_los_criterios_de_abajo():
    # 0,96 y 0,97 de puntualidad caen en el mismo tramo: decide la calificación.
    base = dict(turnos_hechos=10, turnos_en_el_puesto=5)
    personas = {
        "apenas_mas_puntual": _senales(**base, puntualidad=0.97, calificacion=4.0),
        "mejor_valorada": _senales(**base, puntualidad=0.96, calificacion=4.8),
    }
    assert _orden(personas) == ["mejor_valorada", "apenas_mas_puntual"]


def test_entre_quienes_no_tienen_historial_va_primero_quien_esta_verificado():
    personas = {
        "nueva": _senales(),
        "nueva_verificada": _senales(
            identidad_verificada=True, postulado_en=AHORA + timedelta(hours=1)
        ),
    }
    assert _orden(personas) == ["nueva_verificada", "nueva"]
    assert es_nuevo_verificado(personas["nueva_verificada"])
    assert not es_nuevo_verificado(personas["nueva"])


def test_el_sello_de_nuevo_no_va_con_ausencias_ni_con_turnos_hechos():
    assert not es_nuevo_verificado(_senales(identidad_verificada=True, ausencias=1))
    assert not es_nuevo_verificado(_senales(identidad_verificada=True, turnos_hechos=1))


def test_la_calificacion_sin_turnos_que_la_respalden_no_cuenta():
    personas = {
        "cinco_sin_turnos": _senales(calificacion=5.0, postulado_en=AHORA + timedelta(minutes=5)),
        "sin_nada": _senales(),
    }
    # Empatan en todo: decide quién se postuló antes.
    assert _orden(personas) == ["sin_nada", "cinco_sin_turnos"]


def test_a_igualdad_decide_quien_se_postulo_antes_y_sin_fecha_va_al_final():
    personas = {
        "sin_fecha": _senales(postulado_en=None),
        "segunda": _senales(postulado_en=AHORA + timedelta(minutes=2)),
        "primera": _senales(postulado_en=AHORA),
    }
    assert _orden(personas) == ["primera", "segunda", "sin_fecha"]


def test_quien_tuvo_el_turno_y_lo_dejo_va_siempre_al_final():
    personas = {
        "lo_dejo": _senales(
            desasignada=True, es_favorito=True, turnos_hechos=20,
            turnos_en_el_puesto=20, puntualidad=1.0, calificacion=5.0,
        ),
        "nueva": _senales(),
    }
    assert _orden(personas) == ["nueva", "lo_dejo"]
    assert _orden(personas, urgente=True) == ["nueva", "lo_dejo"]


def test_sin_compromisos_el_cumplimiento_es_neutro():
    assert cumplimiento(_senales()) == 0.5
    assert cumplimiento(_senales(cancelaciones=2)) == 0.0
    assert cumplimiento(_senales(turnos_hechos=3, cancelaciones=1, puntualidad=1.0)) == 0.75


# --- Dominio: carril urgente (el orden de antes de P2) ------------------------


def test_en_el_urgente_sigue_el_orden_de_antes():
    personas = {
        "favorita_sin_turnos": _senales(es_favorito=True),
        "con_ausencia_bien_valorada": _senales(
            ausencias=1, turnos_hechos=10, puntualidad=0.9, calificacion=4.9
        ),
        "con_turnos": _senales(turnos_hechos=4, puntualidad=1.0, calificacion=4.5),
    }
    assert _orden(personas, urgente=True) == [
        "con_ausencia_bien_valorada",
        "con_turnos",
        "favorita_sin_turnos",
    ]


def test_que_turno_va_por_el_carril_urgente():
    en_dos_dias = AHORA + timedelta(days=2)
    assert not es_carril_urgente(False, en_dos_dias, AHORA)
    assert es_carril_urgente(True, en_dos_dias, AHORA)  # lo marcó el comercio
    assert es_carril_urgente(False, AHORA + timedelta(hours=5, minutes=59), AHORA)
    assert not es_carril_urgente(False, AHORA + timedelta(hours=6), AHORA)
    assert es_carril_urgente(False, AHORA - timedelta(hours=1), AHORA)  # ya empezó
    # La base de los tests devuelve fechas sin zona (en UTC): tiene que dar igual.
    assert not es_carril_urgente(False, en_dos_dias.replace(tzinfo=None), AHORA)


def test_el_carril_convierte_la_zona_en_vez_de_recortarla():
    # 16:00 de Argentina son las 19:00 UTC: faltan 7 horas, no 4.
    art = timezone(timedelta(hours=-3))
    inicio = datetime(2026, 6, 20, 16, 0, tzinfo=art)
    assert not es_carril_urgente(False, inicio, AHORA)


def test_un_valor_fuera_de_rango_no_gana_el_orden():
    base = dict(turnos_hechos=10, turnos_en_el_puesto=5, puntualidad=1.0)
    personas = {
        "nota_imposible": _senales(**base, calificacion=9.0, postulado_en=AHORA + timedelta(minutes=1)),
        "cinco": _senales(**base, calificacion=5.0),
    }
    assert _orden(personas) == ["cinco", "nota_imposible"]
    assert _orden(personas, urgente=True) == ["cinco", "nota_imposible"]


def test_los_pesos_del_programado_no_premian_la_distancia():
    assert PROGRAMADO_WEIGHTS.distance == 0
    assert PROGRAMADO_WEIGHTS.proven_experience == pytest.approx(0.15)
    assert PROGRAMADO_WEIGHTS.performance == pytest.approx(0.30)
    assert DEFAULT_WEIGHTS.distance == pytest.approx(0.30)
    assert DEFAULT_WEIGHTS.proven_experience == 0


# --- API ----------------------------------------------------------------------

INICIO = "2026-06-28T20:00:00"
# Con este reloj el turno de `INICIO` es programado; con el otro, urgente.
RELOJ_PROGRAMADO = datetime(2026, 6, 25, 12, 0, tzinfo=timezone.utc)
RELOJ_URGENTE = datetime(2026, 6, 28, 21, 0, tzinfo=timezone.utc)


def _reloj(monkeypatch, instante: datetime) -> None:
    monkeypatch.setattr(
        "app.modules.matching.application.services._ahora", lambda: instante
    )


async def _comercio(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", "latitude": -34.58, "longitude": -58.43},
    )
    return headers


async def _persona(client: AsyncClient, email: str, **perfil) -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email)
    payload = {
        "skills": ["mozo"],
        "is_available": True,
        "latitude": -34.58,
        "longitude": -58.43,
    }
    payload.update(perfil)
    created = await client.post("/api/v1/workers/me/profile", headers=headers, json=payload)
    return headers, created.json()["id"]


async def _turno(client: AsyncClient, comercio: dict, **cambios) -> str:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": INICIO,
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "latitude": -34.58,
        "longitude": -58.43,
    }
    payload.update(cambios)
    created = await client.post("/api/v1/shifts", headers=comercio, json=payload)
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    return shift_id


async def _historial(session_factory, profile_id: str, **valores) -> None:
    """Reputación escrita directo en el perfil: a esos números se llega con
    turnos terminados, que acá no hace falta recorrer."""
    async with session_factory() as session:
        await session.execute(
            update(WorkerProfileModel)
            .where(WorkerProfileModel.id == UUID(profile_id))
            .values(**valores)
        )
        await session.commit()


async def _turno_terminado(
    client: AsyncClient, session_factory, comercio: dict, profile_id: str, **cambios
) -> None:
    """Un turno de ese comercio que esa persona ya terminó."""
    shift_id = await _turno(client, comercio, **cambios)
    async with session_factory() as session:
        await session.execute(
            update(ShiftModel)
            .where(ShiftModel.id == UUID(shift_id))
            .values(status="finalizado", worker_profile_id=UUID(profile_id))
        )
        await session.commit()


async def _postulantes(client: AsyncClient, comercio: dict, shift_id: str) -> list[dict]:
    response = await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=comercio)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_postulantes_de_un_turno_programado_llegan_en_el_orden_del_adr(
    client: AsyncClient, session_factory, monkeypatch
):
    _reloj(monkeypatch, RELOJ_PROGRAMADO)
    comercio = await _comercio(client, "orden_emp1@staffya.com")
    otro_comercio = await _comercio(client, "orden_emp1b@staffya.com")

    estrella, estrella_id = await _persona(client, "orden_estrella@staffya.com")
    favorita, favorita_id = await _persona(client, "orden_favorita@staffya.com")
    conocida, conocida_id = await _persona(client, "orden_conocida@staffya.com")
    falto, falto_id = await _persona(client, "orden_falto@staffya.com")
    nueva, nueva_id = await _persona(client, "orden_nueva@staffya.com")

    # Mucha reputación, pero ganada en otro comercio.
    await _historial(
        session_factory, estrella_id, events_completed=30, rating=5.0, punctuality_rate=1.0
    )
    for _ in range(2):
        await _turno_terminado(client, session_factory, otro_comercio, estrella_id)
    # Ya terminó un turno acá, de runner: confianza del local, pero no
    # experiencia en este puesto.
    await _historial(
        session_factory, conocida_id, events_completed=1, rating=4.0, punctuality_rate=0.9
    )
    await _turno_terminado(
        client, session_factory, comercio, conocida_id, position="runner"
    )
    # Buena calificación y una ausencia.
    await _historial(
        session_factory, falto_id, events_completed=20, rating=4.9,
        punctuality_rate=1.0, no_shows=1,
    )
    await client.put(f"/api/v1/favorites/{favorita_id}", headers=comercio)

    shift_id = await _turno(client, comercio)
    # Se postulan en el orden inverso al esperado.
    for persona in (nueva, falto, estrella, conocida, favorita):
        applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=persona)
        assert applied.status_code == 201, applied.text

    filas = await _postulantes(client, comercio, shift_id)
    # Confianza del local (a igualdad, quien se postuló antes), después sin
    # faltas con experiencia en el puesto, la nueva, y al final la ausencia.
    assert [f["worker_profile_id"] for f in filas] == [
        conocida_id, favorita_id, estrella_id, nueva_id, falto_id,
    ]
    por_id = {f["worker_profile_id"]: f for f in filas}
    assert por_id[favorita_id]["es_favorito"] is True
    assert por_id[favorita_id]["trabajo_aca"] is False
    assert por_id[conocida_id]["trabajo_aca"] is True
    assert por_id[conocida_id]["turnos_en_el_puesto"] == 0  # fue de runner
    assert por_id[estrella_id]["turnos_en_el_puesto"] == 2
    assert por_id[estrella_id]["trabajo_aca"] is False  # fue en otro comercio
    assert por_id[nueva_id]["nuevo_verificado"] is False  # sin verificar
    # No se suma a la respuesta nada que el comercio no viera ya.
    assert "no_shows" not in por_id[falto_id]
    assert "cancellations" not in por_id[falto_id]


@pytest.mark.asyncio
async def test_el_mismo_turno_ya_urgente_usa_el_orden_de_antes(
    client: AsyncClient, session_factory, monkeypatch
):
    comercio = await _comercio(client, "orden_emp2@staffya.com")
    favorita, favorita_id = await _persona(client, "orden_fav2@staffya.com")
    con_turnos, con_turnos_id = await _persona(client, "orden_turnos2@staffya.com")
    await _historial(
        session_factory, con_turnos_id, events_completed=5, rating=4.5, punctuality_rate=1.0
    )
    await client.put(f"/api/v1/favorites/{favorita_id}", headers=comercio)
    shift_id = await _turno(client, comercio)
    for persona in (favorita, con_turnos):
        await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=persona)

    _reloj(monkeypatch, RELOJ_PROGRAMADO)
    programado = await _postulantes(client, comercio, shift_id)
    assert [f["worker_profile_id"] for f in programado] == [favorita_id, con_turnos_id]

    _reloj(monkeypatch, RELOJ_URGENTE)
    urgente = await _postulantes(client, comercio, shift_id)
    assert [f["worker_profile_id"] for f in urgente] == [con_turnos_id, favorita_id]


@pytest.mark.asyncio
async def test_recomendados_de_un_programado_no_premian_la_cercania(
    client: AsyncClient, session_factory, monkeypatch
):
    comercio = await _comercio(client, "orden_emp3@staffya.com")
    # Al lado del local, sin turnos en el puesto.
    _, cerca_id = await _persona(client, "orden_cerca@staffya.com")
    # A unos 15 km (dentro del radio de 25), con turnos terminados de mozo.
    _, lejos_id = await _persona(
        client, "orden_lejos@staffya.com", latitude=-34.70, longitude=-58.50
    )
    for _ in range(4):
        await _turno_terminado(client, session_factory, comercio, lejos_id)
    shift_id = await _turno(client, comercio)

    async def recomendados() -> list[str]:
        response = await client.get(f"/api/v1/shifts/{shift_id}/candidates", headers=comercio)
        assert response.status_code == 200, response.text
        return [c["profile_id"] for c in response.json()]

    _reloj(monkeypatch, RELOJ_URGENTE)
    assert await recomendados() == [cerca_id, lejos_id]
    _reloj(monkeypatch, RELOJ_PROGRAMADO)
    assert await recomendados() == [lejos_id, cerca_id]


@pytest.mark.asyncio
async def test_recomendados_de_un_programado_siguen_cortando_por_radio(
    client: AsyncClient, monkeypatch
):
    _reloj(monkeypatch, RELOJ_PROGRAMADO)
    comercio = await _comercio(client, "orden_emp4@staffya.com")
    # Córdoba: a más de 600 km. La distancia no puntúa, pero sí filtra.
    await _persona(client, "orden_cordoba@staffya.com", latitude=-31.42, longitude=-64.18)
    shift_id = await _turno(client, comercio)
    response = await client.get(f"/api/v1/shifts/{shift_id}/candidates", headers=comercio)
    assert response.json() == []


@pytest.mark.asyncio
async def test_postulantes_de_un_turno_ajeno_siguen_dando_404(
    client: AsyncClient, monkeypatch
):
    _reloj(monkeypatch, RELOJ_PROGRAMADO)
    comercio = await _comercio(client, "orden_emp5@staffya.com")
    ajeno = await _comercio(client, "orden_emp5b@staffya.com")
    shift_id = await _turno(client, comercio)
    response = await client.get(f"/api/v1/applications/shifts/{shift_id}", headers=ajeno)
    assert response.status_code == 404
