"""U080: un turno que se reabre con el horario ya empezado se reofrece como
urgente hasta que termina, y se paga lo que resta desde la llegada del
reemplazo (ADR-0015 y ADR-0008, actualización 2026-11-18; decisiones 4, 16,
18 y 19 del tablero de la beta).

Primero el dominio (sin base), después los casos de uso por la API."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.modules.shift.application import scheduler
from app.modules.shift.application.services import (
    CHECKIN_REMINDER_DELAY,
    NO_SHOW_GRACE_PERIOD,
    coverage_deadline,
)
from app.modules.shift.domain.entities import (
    NO_SHOW_EARLIEST_AFTER_START,
    REOFFER_MIN_REMAINING,
    Reapertura,
    Shift,
)
from app.modules.shift.domain.exceptions import InvalidShiftTransitionError
from app.modules.shift.domain.punctuality import punctuality_of
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill
from tests.conftest import auth_headers

PALERMO = {"latitude": -34.58, "longitude": -58.43}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _turno(
    *,
    empezo_hace: timedelta,
    dura: timedelta = timedelta(hours=4),
    status: ShiftStatus = ShiftStatus.CONFIRMADO,
    pay: str = "40000",
    confirmo_antes: bool = True,
) -> Shift:
    """Turno con alguien asignado. `empezo_hace` negativo = todavía no empezó."""
    start = _now() - empezo_hace
    shift = Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=start,
        end_at=start + dura,
        pay_amount=Decimal(pay),
        status=status,
        worker_profile_id=uuid4(),
    )
    if status == ShiftStatus.CONFIRMADO and confirmo_antes:
        shift.confirmed_at = start - timedelta(hours=3)
    return shift


# --- Dominio: cómo sigue un turno que alguien dejó -------------------------


def test_ausencia_con_horario_por_delante_reofrece_como_urgente():
    shift = _turno(empezo_hace=timedelta(minutes=30))
    shift.checkin_reminder_sent_at = _now()
    faltante = shift.worker_profile_id

    assert shift.no_show() is Reapertura.REOFRECIDO

    assert shift.status == ShiftStatus.BUSCANDO_PERSONAL
    assert shift.is_reoffered and shift.reoffered_at is not None
    assert shift.urgent is True
    # La escalada no tiene que avisar otra vez: el aviso sale con la reoferta.
    assert shift.escalated_at is not None
    assert shift.worker_profile_id is None
    assert shift.last_no_show_worker_profile_id == faltante
    # Lo de la persona que se fue se va con ella.
    assert shift.confirmed_at is None
    assert shift.checkin_reminder_sent_at is None


def test_ausencia_con_menos_de_una_hora_pasa_a_no_cubierto():
    shift = _turno(empezo_hace=timedelta(hours=3, minutes=30))  # quedan 30 min
    faltante = shift.worker_profile_id

    assert shift.no_show() is Reapertura.SIN_CUBRIR

    assert shift.status == ShiftStatus.NO_CUBIERTO
    assert shift.reoffered_at is None
    assert shift.worker_profile_id is None
    assert shift.last_no_show_worker_profile_id == faltante
    assert shift.no_show_at is not None


def test_el_limite_son_dos_horas_justas():
    start = datetime(2026, 11, 18, 20, 0, tzinfo=timezone.utc)

    def reabrir(now: datetime) -> tuple[Reapertura, Shift]:
        shift = Shift(
            company_id=uuid4(),
            position=WorkerSkill.MOZO,
            quantity=1,
            start_at=start,
            end_at=start + timedelta(hours=4),
            pay_amount=Decimal("40000"),
            status=ShiftStatus.CONFIRMADO,
            worker_profile_id=uuid4(),
        )
        return shift.worker_cancel(now=now), shift

    assert REOFFER_MIN_REMAINING == timedelta(hours=2)
    justo, shift = reabrir(start + timedelta(hours=4) - REOFFER_MIN_REMAINING)
    assert justo is Reapertura.REOFRECIDO
    assert shift.reoffered_at == start + timedelta(hours=2)

    por_poco, shift = reabrir(start + timedelta(hours=2, seconds=1))
    assert por_poco is Reapertura.SIN_CUBRIR
    assert shift.status == ShiftStatus.NO_CUBIERTO

    # En el instante del inicio ya empezó.
    al_inicio, _ = reabrir(start)
    assert al_inicio is Reapertura.REOFRECIDO
    antes, shift = reabrir(start - timedelta(seconds=1))
    assert antes is Reapertura.ABIERTO
    assert shift.reoffered_at is None and shift.urgent is False


def test_cancelar_antes_de_empezar_reabre_como_siempre():
    shift = _turno(empezo_hace=-timedelta(hours=5))

    assert shift.worker_cancel() is Reapertura.ABIERTO

    assert shift.status == ShiftStatus.BUSCANDO_PERSONAL
    assert not shift.is_reoffered
    assert shift.urgent is False
    assert shift.escalated_at is None
    assert shift.confirmed_at is None


def test_cancelar_con_el_turno_empezado_reofrece():
    shift = _turno(empezo_hace=timedelta(minutes=5))
    assert shift.worker_cancel() is Reapertura.REOFRECIDO
    assert shift.status == ShiftStatus.BUSCANDO_PERSONAL and shift.urgent


def test_cancelar_sin_dos_horas_de_horario_deja_el_turno_sin_cubrir():
    shift = _turno(empezo_hace=timedelta(minutes=5), dura=timedelta(hours=2))
    tenia = shift.worker_profile_id

    assert shift.worker_cancel() is Reapertura.SIN_CUBRIR

    assert shift.status == ShiftStatus.NO_CUBIERTO
    # Igual que `mark_not_covered`: queda quién lo tenía.
    assert shift.last_no_show_worker_profile_id == tenia
    assert shift.no_show_at is None  # no fue una ausencia


def test_rechazar_con_el_turno_empezado_sigue_la_misma_regla():
    con_horario = _turno(empezo_hace=timedelta(minutes=10), status=ShiftStatus.ASIGNADO)
    assert con_horario.reject() is Reapertura.REOFRECIDO
    assert con_horario.is_reoffered

    sin_horario = _turno(
        empezo_hace=timedelta(minutes=10), dura=timedelta(hours=2), status=ShiftStatus.ASIGNADO
    )
    assert sin_horario.reject() is Reapertura.SIN_CUBRIR
    assert sin_horario.status == ShiftStatus.NO_CUBIERTO

    sin_empezar = _turno(empezo_hace=-timedelta(hours=1), status=ShiftStatus.ASIGNADO)
    assert sin_empezar.reject() is Reapertura.ABIERTO
    assert not sin_empezar.is_reoffered


def test_la_suspension_antes_de_empezar_no_reofrece():
    shift = _turno(empezo_hace=-timedelta(hours=2))
    assert shift.release_worker() is Reapertura.ABIERTO
    assert shift.status == ShiftStatus.BUSCANDO_PERSONAL and not shift.is_reoffered


def test_reofrecer_no_pisa_una_escalada_anterior():
    shift = _turno(empezo_hace=timedelta(minutes=30))
    escalado = _now() - timedelta(hours=6)
    shift.escalated_at = escalado
    shift.no_show()
    assert shift.escalated_at == escalado


def test_un_reofrecido_que_se_vuelve_a_reabrir_repite_la_regla():
    shift = _turno(empezo_hace=timedelta(minutes=30))
    shift.no_show()
    primera = shift.reoffered_at

    shift.assign(uuid4())
    shift.confirm()
    assert shift.taken_after_start
    assert shift.worker_cancel() is Reapertura.REOFRECIDO
    assert shift.reoffered_at is not None and shift.reoffered_at >= primera
    assert shift.confirmed_at is None

    # Ciclo nuevo, pero ya sin dos horas por delante: se cierra.
    shift.assign(uuid4())
    shift.confirm()
    al_final = shift.end_at - timedelta(hours=1, minutes=50)
    assert shift.worker_cancel(now=al_final) is Reapertura.SIN_CUBRIR
    assert shift.status == ShiftStatus.NO_CUBIERTO


# --- Dominio: hasta cuándo se ofrece ---------------------------------------


def test_un_reofrecido_se_ofrece_mientras_le_queden_dos_horas():
    shift = _turno(empezo_hace=timedelta(minutes=30))
    shift.no_show()

    assert shift.offered_until == shift.end_at - timedelta(hours=2)
    assert shift.is_open_for_applications(_now())
    assert shift.is_open_for_applications(shift.offered_until - timedelta(seconds=1))
    assert not shift.is_open_for_applications(shift.offered_until)
    assert not shift.is_open_for_applications(shift.end_at - timedelta(seconds=1))
    # Si nadie confirmó para entonces, la pasada de cobertura lo cierra.
    assert coverage_deadline(shift) == shift.offered_until.replace(tzinfo=None)


def test_un_turno_empezado_que_no_se_reofrecio_no_se_ofrece():
    shift = _turno(empezo_hace=timedelta(minutes=30), status=ShiftStatus.BUSCANDO_PERSONAL)
    assert not shift.is_open_for_applications(_now())
    # Y su plazo de «no cubierto» sigue siendo el inicio más la gracia.
    assert coverage_deadline(shift) == (
        shift.start_at + NO_SHOW_GRACE_PERIOD
    ).replace(tzinfo=None)


# --- Dominio: quien lo toma ya empezado ------------------------------------


def _tomado_ya_empezado(**kwargs) -> Shift:
    """Reofrecido y confirmado ahora por el reemplazo."""
    shift = _turno(**kwargs)
    shift.no_show()
    shift.assign(uuid4())
    shift.confirm()
    return shift


def test_a_quien_confirmo_antes_se_lo_espera_desde_el_inicio():
    shift = _turno(empezo_hace=-timedelta(hours=1), status=ShiftStatus.ASIGNADO)
    shift.confirm()
    assert shift.confirmed_at is not None
    assert not shift.taken_after_start
    assert shift.expected_from == shift.start_at


def test_al_reemplazo_se_lo_espera_desde_que_confirmo():
    shift = _tomado_ya_empezado(empezo_hace=timedelta(hours=1))
    assert shift.taken_after_start
    assert shift.expected_from == shift.confirmed_at


def test_la_ausencia_del_reemplazo_se_habilita_desde_que_confirmo():
    shift = _tomado_ya_empezado(empezo_hace=timedelta(hours=1))
    confirmo = shift.confirmed_at

    # El turno empezó hace una hora, pero confirmó recién: todavía no.
    with pytest.raises(InvalidShiftTransitionError) as exc:
        shift.no_show()
    assert "después de que confirmó el reemplazo" in str(exc.value)

    antes = confirmo + NO_SHOW_EARLIEST_AFTER_START - timedelta(seconds=1)
    with pytest.raises(InvalidShiftTransitionError):
        shift.no_show(now=antes)

    assert shift.no_show(now=confirmo + NO_SHOW_EARLIEST_AFTER_START) is Reapertura.REOFRECIDO


def test_el_reemplazo_cobra_lo_que_resta_desde_que_llega():
    shift = _tomado_ya_empezado(empezo_hace=timedelta(hours=1))  # dura 4 h
    assert shift.hourly_pay_amount == Decimal("10000")
    assert shift.amount_due == Decimal("40000")  # todavía no llegó: sin fijar

    shift.check_in(0, 0)

    # Quedan 3 de 4 horas: 30.000, menos los segundos que tardó el test.
    assert shift.prorated_pay_amount is not None
    assert Decimal("29900") <= shift.prorated_pay_amount <= Decimal("30000")
    assert shift.amount_due == shift.prorated_pay_amount
    assert shift.prorated_pay_amount == shift.prorated_pay_amount.to_integral_value()
    # Con el monto fijado ya no se muestra el valor por hora.
    assert shift.hourly_pay_amount is None


@pytest.mark.parametrize(
    ("pay", "minutos_trabajados", "esperado"),
    [
        ("40000", 180, "30000"),  # 3 de 4 horas
        ("40000", 240, "40000"),  # nunca más que lo publicado
        ("40000", 0, "0"),
        ("10000", 80, "3333"),  # 3333,33 → abajo
        ("10000", 160, "6667"),  # 6666,67 → arriba
        ("1001", 120, "501"),  # 500,5 → mitad para arriba
    ],
)
def test_el_prorrateo_redondea_al_peso(pay: str, minutos_trabajados: int, esperado: str):
    start = datetime(2026, 11, 18, 20, 0, tzinfo=timezone.utc)
    shift = Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=start,
        end_at=start + timedelta(hours=4),
        pay_amount=Decimal(pay),
    )
    llegada = shift.end_at - timedelta(minutes=minutos_trabajados)
    assert shift._prorated_from(llegada) == Decimal(esperado)


def test_el_prorrateo_nunca_supera_lo_publicado_ni_es_negativo():
    start = datetime(2026, 11, 18, 20, 0, tzinfo=timezone.utc)
    shift = Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=start,
        end_at=start + timedelta(hours=4),
        pay_amount=Decimal("40000"),
    )
    assert shift._prorated_from(start - timedelta(hours=1)) == Decimal("40000")
    assert shift._prorated_from(shift.end_at + timedelta(hours=1)) == Decimal("0")


def test_no_se_marca_la_llegada_a_un_reofrecido_que_ya_termino():
    shift = _tomado_ya_empezado(empezo_hace=timedelta(hours=1))
    # El horario terminó sin que llegara.
    shift.start_at = _now() - timedelta(hours=5)
    shift.end_at = _now() - timedelta(minutes=1)

    with pytest.raises(InvalidShiftTransitionError) as exc:
        shift.check_in(0, 0)
    assert "ya terminó" in str(exc.value)
    assert shift.status == ShiftStatus.CONFIRMADO
    assert shift.prorated_pay_amount is None


def test_llegar_tarde_a_un_turno_normal_no_prorratea():
    shift = _turno(empezo_hace=timedelta(hours=1))
    shift.check_in(0, 0)
    assert shift.prorated_pay_amount is None
    assert shift.amount_due == Decimal("40000")
    assert shift.hourly_pay_amount is None


def test_la_puntualidad_no_se_mueve_para_quien_lo_tomo_ya_empezado():
    start = datetime(2026, 11, 18, 20, 0)
    llego = start + timedelta(hours=1, minutes=40)
    # El reemplazo de un turno reofrecido: ni a favor ni en contra.
    assert punctuality_of(llego, start, taken_after_start=True) is None
    # Cualquier otro: la regla de siempre, contra el inicio.
    assert punctuality_of(start + timedelta(minutes=10), start, taken_after_start=False) is True
    assert punctuality_of(llego, start, taken_after_start=False) is False


def test_en_un_turno_comun_confirmar_tarde_no_cambia_las_reglas():
    """Asignado antes del inicio (o en la gracia de «no cubierto») y
    confirmado con el turno ya empezado, pero sin reofrecer: se lo espera
    desde el inicio, como antes de U080."""
    shift = _turno(empezo_hace=timedelta(minutes=40), status=ShiftStatus.ASIGNADO)
    shift.confirm()
    assert shift.confirmed_at is not None and shift.confirmed_at > shift.start_at
    assert not shift.is_reoffered
    assert not shift.taken_after_start
    assert shift.expected_from == shift.start_at

    # «No se presentó» desde los 15 minutos del inicio, no de la confirmación.
    with pytest.raises(InvalidShiftTransitionError) as exc:
        shift.no_show(now=shift.start_at + NO_SHOW_EARLIEST_AFTER_START - timedelta(seconds=1))
    assert "después de que empieza el turno" in str(exc.value)
    assert shift.no_show(now=shift.start_at + NO_SHOW_EARLIEST_AFTER_START) is Reapertura.REOFRECIDO


# --- Casos de uso, por la API ----------------------------------------------

asyncio = pytest.mark.asyncio


def _payload(start_at: datetime, *, horas: float = 4, pay: str = "40000.00") -> dict:
    return {
        "position": "mozo",
        "quantity": 1,
        "start_at": start_at.replace(tzinfo=None).isoformat(),
        "end_at": (start_at + timedelta(hours=horas)).replace(tzinfo=None).isoformat(),
        "pay_amount": pay,
        "city": "Palermo",
        **PALERMO,
    }


async def _comercio(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo", **PALERMO},
    )
    return headers


async def _trabajador(client: AsyncClient, email: str, nombre: str = "Test User") -> tuple[dict, str]:
    headers = await auth_headers(client, "worker", email, full_name=nombre)
    profile = await client.post(
        "/api/v1/workers/me/profile",
        headers=headers,
        json={"skills": ["mozo"], "city": "Palermo", "is_available": True, **PALERMO},
    )
    assert profile.status_code in (200, 201), profile.text
    return headers, profile.json()["id"]


async def _turno_confirmado_y_empezado(
    client: AsyncClient,
    tag: str,
    *,
    empezo_hace: timedelta = timedelta(minutes=30),
    horas: float = 4,
) -> tuple[str, dict, dict, str]:
    """A tiene confirmado un turno común que empezó hace `empezo_hace`.

    Lo confirma ahora, con el turno ya empezado: en un turno común eso no
    cambia nada (se lo espera desde el inicio, como a quien confirmó antes)."""
    comercio = await _comercio(client, f"reof_emp_{tag}@staffya.com")
    a, a_id = await _trabajador(client, f"reof_a_{tag}@staffya.com", "Ana Ausente")
    created = await client.post(
        "/api/v1/shifts", headers=comercio, json=_payload(_now() - empezo_hace, horas=horas)
    )
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    ).status_code == 200
    assert (
        await client.post(
            f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": a_id}
        )
    ).status_code == 200
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=a)
    ).status_code == 200
    return shift_id, comercio, a, a_id


async def _avisos(client: AsyncClient, headers: dict, tipo: str) -> list[dict]:
    response = await client.get("/api/v1/notifications", headers=headers)
    return [n for n in response.json() if n["type"] == tipo]


@asyncio
async def test_ausencia_reofrece_avisa_y_el_reemplazo_cobra_lo_que_resta(client: AsyncClient):
    """El camino entero: A falta, el turno se reofrece, B lo toma ya empezado,
    llega y cobra lo que resta."""
    b, b_id = await _trabajador(client, "reof_b_camino@staffya.com", "Beto Reemplazo")
    shift_id, comercio, a, _a_id = await _turno_confirmado_y_empezado(client, "camino")
    # Lo que haya avisado la publicación no cuenta para este test.
    antes_b = len(await _avisos(client, b, "urgent_shift_nearby"))

    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    assert marked.status_code == 200, marked.text
    body = marked.json()
    assert body["status"] == "buscando_personal"
    assert body["urgent"] is True
    assert body["reoffered_at"] is not None
    assert Decimal(body["hourly_pay_amount"]) == Decimal("10000")
    assert body["prorated_pay_amount"] is None

    # Al comercio: UN aviso, que dice qué pasó y qué sigue.
    [reabierto] = await _avisos(client, comercio, "shift_reopened")
    assert reabierto["message"].startswith('Marcaste que Ana Ausente no se presentó a "Mozo')
    assert "lo reofrecimos como urgente hasta las" in reabierto["message"]
    assert "se paga lo que reste desde que llegue el reemplazo" in reabierto["message"]
    assert reabierto["link"] == f"/shifts/{shift_id}/candidates"
    assert await _avisos(client, comercio, "shift_not_covered") == []

    # A quienes están cerca: un aviso urgente con el valor por hora. A quien
    # lo dejó, no.
    urgentes_b = await _avisos(client, b, "urgent_shift_nearby")
    assert len(urgentes_b) == antes_b + 1
    aviso = urgentes_b[0]
    assert aviso["title"].startswith("¡Urgente! ")
    assert "el turno empezó y va hasta las" in aviso["message"]
    assert "Paga $10.000 por hora, desde que llegás." in aviso["message"]
    assert aviso["link"] == f"/turno/{shift_id}"
    assert await _avisos(client, a, "urgent_shift_nearby") == []

    # Vuelve al Inicio y a la página pública, con el valor por hora.
    feed = await client.get("/api/v1/shifts/feed", headers=b)
    [en_feed] = [s for s in feed.json() if s["id"] == shift_id]
    assert en_feed["reoffered_at"] is not None
    assert Decimal(en_feed["hourly_pay_amount"]) == Decimal("10000")
    assert en_feed["prorated_pay_amount"] is None and en_feed["confirmed_at"] is None
    public = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert public.status_code == 200
    assert public.json()["reoffered_at"] is not None
    assert Decimal(public.json()["hourly_pay_amount"]) == Decimal("10000")

    # B se postula, lo asignan y confirma.
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=b)
    assert applied.status_code == 201, applied.text
    assert (
        await client.post(
            f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": b_id}
        )
    ).status_code == 200
    confirmed = await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=b)
    assert confirmed.status_code == 200
    assert confirmed.json()["confirmed_at"] is not None

    # Recién confirmó: no se le puede marcar la ausencia todavía.
    pronto = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    assert pronto.status_code == 400
    assert "después de que confirmó el reemplazo" in pronto.json()["detail"]

    # Llega: el monto queda fijo en lo que resta (3 h 30 de 4 h = 35.000).
    checked = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in", headers=b, json=PALERMO
    )
    assert checked.status_code == 200, checked.text
    fijo = Decimal(checked.json()["prorated_pay_amount"])
    assert Decimal("34800") <= fijo <= Decimal("35000")
    assert checked.json()["hourly_pay_amount"] is None

    # Lo ven las partes; quien no es parte, no.
    mine = await client.get("/api/v1/shifts/mine", headers=b)
    [mio] = [s for s in mine.json() if s["id"] == shift_id]
    assert Decimal(mio["prorated_pay_amount"]) == fijo
    panel = await client.get("/api/v1/shifts/me", headers=comercio)
    [del_comercio] = [s for s in panel.json() if s["id"] == shift_id]
    assert Decimal(del_comercio["prorated_pay_amount"]) == fijo
    ajeno = await client.get(f"/api/v1/shifts/{shift_id}", headers=a)
    assert ajeno.status_code == 404
    postulaciones_a = await client.get("/api/v1/applications/mine", headers=a)
    for application in postulaciones_a.json():
        if application.get("shift") and application["shift"]["id"] == shift_id:
            assert application["shift"]["prorated_pay_amount"] is None
            assert application["shift"]["confirmed_at"] is None

    # Termina y se cierra: las ganancias usan el monto fijado y su
    # puntualidad no se mueve (es su primer turno: sin llegadas tarde).
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=b, json=PALERMO)
    ).status_code == 200
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=comercio)
    ).status_code == 200
    earnings = await client.get("/api/v1/workers/me/earnings", headers=b)
    assert earnings.status_code == 200
    assert Decimal(str(earnings.json()["total_earned"])) == fijo
    perfil = (await client.get("/api/v1/workers/me/profile", headers=b)).json()
    assert perfil["events_completed"] == 1
    assert perfil["punctuality_rate"] == pytest.approx(1.0)


@asyncio
async def test_la_puntualidad_que_ya_tenia_no_se_mueve(client: AsyncClient, session_factory):
    from app.modules.worker.infrastructure.models import WorkerProfileModel

    b, b_id = await _trabajador(client, "reof_b_punt@staffya.com")
    async with session_factory() as session:
        model = await session.get(WorkerProfileModel, UUID(b_id))
        model.events_completed = 4
        model.punctuality_rate = 0.75
        await session.commit()
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(client, "punt")
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": b_id}
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=b)
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=b, json=PALERMO)
    await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=b, json=PALERMO)
    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=comercio)
    assert finished.status_code == 200, finished.text

    perfil = (await client.get("/api/v1/workers/me/profile", headers=b)).json()
    assert perfil["events_completed"] == 5
    assert perfil["punctuality_rate"] == pytest.approx(0.75)


@asyncio
async def test_turno_comun_confirmado_tarde_se_mide_desde_el_inicio(
    client: AsyncClient, session_factory, monkeypatch
):
    """Un turno común confirmado con el horario ya empezado sigue las reglas
    de antes de U080: recordatorio, «No se presentó» y ausencia automática
    desde el inicio, y la puntualidad medida contra el inicio."""
    from app.modules.worker.infrastructure.models import WorkerProfileModel

    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)

    async def estado(shift_id: str, comercio: dict) -> str:
        r = await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)
        return r.json()["status"]

    # Empezó hace 40 minutos y lo confirmó recién: el recordatorio sale ya
    # (20 minutos desde el inicio) y la ausencia se puede marcar (15).
    shift_id, comercio, a, _a_id = await _turno_confirmado_y_empezado(
        client, "comun_rec", empezo_hace=timedelta(minutes=40)
    )
    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detalle["reoffered_at"] is None
    await scheduler.run_attendance_check()
    assert await estado(shift_id, comercio) == "confirmado"
    assert len(await _avisos(client, a, "checkin_reminder")) == 1
    marcado = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    assert marcado.status_code == 200, marcado.text

    # Empezó hace más de 2 horas y lo confirmó recién: ausencia automática
    # en la primera pasada (contada desde el inicio, no desde la confirmación).
    shift_id, comercio, b, _b_id = await _turno_confirmado_y_empezado(
        client, "comun_aus", empezo_hace=NO_SHOW_GRACE_PERIOD + timedelta(minutes=5), horas=8
    )
    await scheduler.run_attendance_check()
    assert await estado(shift_id, comercio) == "buscando_personal"
    assert len(await _avisos(client, b, "shift_no_show")) == 1

    # Llegó 40 minutos tarde: le baja la puntualidad (no es un reemplazo).
    shift_id, comercio, c, c_id = await _turno_confirmado_y_empezado(
        client, "comun_punt", empezo_hace=timedelta(minutes=40)
    )
    async with session_factory() as session:
        model = await session.get(WorkerProfileModel, UUID(c_id))
        model.events_completed = 4
        model.punctuality_rate = 0.75
        await session.commit()
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=c, json=PALERMO)
    await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=c, json=PALERMO)
    finished = await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=comercio)
    assert finished.status_code == 200, finished.text
    perfil = (await client.get("/api/v1/workers/me/profile", headers=c)).json()
    assert perfil["events_completed"] == 5
    assert perfil["punctuality_rate"] == pytest.approx(0.6)


@asyncio
async def test_ausencia_sin_dos_horas_de_horario_cierra_el_turno_con_un_solo_aviso(
    client: AsyncClient,
):
    b, _b_id = await _trabajador(client, "reof_b_corto@staffya.com")
    shift_id, comercio, a, _a_id = await _turno_confirmado_y_empezado(
        client, "corto", empezo_hace=timedelta(minutes=20), horas=2
    )
    antes_b = len(await _avisos(client, b, "urgent_shift_nearby"))

    marked = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    assert marked.status_code == 200, marked.text
    assert marked.json()["status"] == "no_cubierto"
    assert marked.json()["reoffered_at"] is None

    [aviso] = await _avisos(client, comercio, "shift_not_covered")
    assert "Ana Ausente no se presentó y quedan menos de 2 horas de horario" in aviso["message"]
    assert "no lo reofrecimos" in aviso["message"]
    assert await _avisos(client, comercio, "shift_reopened") == []
    # Nadie más recibe nada; a quien faltó le cuenta la ausencia.
    assert len(await _avisos(client, b, "urgent_shift_nearby")) == antes_b
    assert len(await _avisos(client, a, "shift_no_show")) == 1
    perfil_a = (await client.get("/api/v1/workers/me/profile", headers=a)).json()
    assert perfil_a["no_shows"] == 1
    # No vuelve al Inicio ni a la página pública.
    feed = await client.get("/api/v1/shifts/feed", headers=b)
    assert shift_id not in [s["id"] for s in feed.json()]
    assert (await client.get(f"/api/v1/shifts/{shift_id}/public")).status_code == 410


@asyncio
async def test_cancelar_con_el_turno_empezado_reofrece_y_lo_dice(client: AsyncClient):
    shift_id, comercio, a, _a_id = await _turno_confirmado_y_empezado(
        client, "cancela", empezo_hace=timedelta(minutes=5)
    )

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=a)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "buscando_personal"
    assert cancelled.json()["reoffered_at"] is not None

    [aviso] = await _avisos(client, comercio, "shift_reopened")
    assert aviso["title"] == "El trabajador canceló su asignación"
    assert "Como ya había empezado, lo reofrecimos como urgente hasta las" in aviso["message"]
    assert "Volvió a buscar personal" not in aviso["message"]
    perfil_a = (await client.get("/api/v1/workers/me/profile", headers=a)).json()
    assert perfil_a["cancellations"] == 1


@asyncio
async def test_cancelar_antes_de_empezar_avisa_como_siempre(client: AsyncClient):
    comercio = await _comercio(client, "reof_emp_antes@staffya.com")
    a, a_id = await _trabajador(client, "reof_a_antes@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=comercio, json=_payload(_now() + timedelta(hours=5))
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": a_id}
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=a)

    cancelled = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=a)
    assert cancelled.status_code == 200
    assert cancelled.json()["reoffered_at"] is None
    assert cancelled.json()["urgent"] is False
    assert cancelled.json()["hourly_pay_amount"] is None

    [aviso] = await _avisos(client, comercio, "shift_reopened")
    assert aviso["message"].endswith("luego de confirmarla. Volvió a buscar personal.")


@asyncio
async def test_rechazar_con_el_turno_empezado_reofrece(client: AsyncClient):
    comercio = await _comercio(client, "reof_emp_rech@staffya.com")
    a, a_id = await _trabajador(client, "reof_a_rech@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=comercio, json=_payload(_now() - timedelta(minutes=10))
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": a_id}
    )

    rejected = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=a)
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "buscando_personal"
    assert rejected.json()["reoffered_at"] is not None

    [aviso] = await _avisos(client, comercio, "shift_rejected")
    assert "lo reofrecimos como urgente hasta las" in aviso["message"]
    assert await _avisos(client, comercio, "shift_reopened") == []


@asyncio
async def test_con_menos_de_dos_horas_ya_no_se_ofrece_ni_acepta_postulaciones(
    client: AsyncClient, session_factory
):
    b, _b_id = await _trabajador(client, "reof_b_fin@staffya.com")
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(client, "fin")
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    assert shift_id in [s["id"] for s in (await client.get("/api/v1/shifts/feed", headers=b)).json()]

    # Le quedan 1 h 59 de horario y la pasada que lo cierra todavía no corrió.
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.end_at = _now() + REOFFER_MIN_REMAINING - timedelta(minutes=1)
        model.start_at = model.end_at - timedelta(hours=4)
        await session.commit()

    feed = await client.get("/api/v1/shifts/feed", headers=b)
    assert shift_id not in [s["id"] for s in feed.json()]
    buscar = await client.get("/api/v1/shifts/feed?scope=all", headers=b)
    assert shift_id not in [s["id"] for s in buscar.json()]
    assert (await client.get(f"/api/v1/shifts/{shift_id}/public")).status_code == 410
    applied = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=b)
    assert applied.status_code in (400, 404, 409), applied.text
    assert applied.status_code != 201


@asyncio
async def test_el_recordatorio_y_la_ausencia_del_reemplazo_se_cuentan_desde_que_confirmo(
    client: AsyncClient, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    b, b_id = await _trabajador(client, "reof_b_sched@staffya.com")
    # El turno empezó hace 2 h 30: para alguien que confirmó a tiempo ya
    # sería ausencia automática.
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(
        client, "sched", empezo_hace=timedelta(hours=2, minutes=30), horas=8
    )
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": b_id}
    )
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=b)
    ).status_code == 200

    async def estado() -> str:
        r = await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)
        return r.json()["status"]

    async def confirmo_hace(delta: timedelta) -> None:
        async with session_factory() as session:
            model = await session.get(ShiftModel, UUID(shift_id))
            model.confirmed_at = _now() - delta
            await session.commit()

    # Recién confirmó: ni recordatorio ni ausencia, y la próxima fecha que
    # vigila el scheduler es su recordatorio.
    proxima = await scheduler.run_attendance_check()
    assert await estado() == "confirmado"
    assert await _avisos(client, b, "checkin_reminder") == []
    assert proxima is not None
    en = proxima - datetime.now(timezone.utc).replace(tzinfo=None)
    assert timedelta(minutes=18) < en <= CHECKIN_REMINDER_DELAY

    # A los 20 minutos de confirmar: su recordatorio (aunque A ya había
    # recibido el suyo en este mismo turno, la marca se fue con A).
    await confirmo_hace(CHECKIN_REMINDER_DELAY + timedelta(minutes=1))
    await scheduler.run_attendance_check()
    assert await estado() == "confirmado"
    assert len(await _avisos(client, b, "checkin_reminder")) == 1

    # A las 2 horas de confirmar: ausencia automática.
    await confirmo_hace(NO_SHOW_GRACE_PERIOD + timedelta(minutes=1))
    await scheduler.run_attendance_check()
    assert await estado() == "buscando_personal"  # le quedan más de 3 h: se reofrece otra vez
    assert len(await _avisos(client, b, "shift_no_show")) == 1


@asyncio
async def test_la_escalada_no_vuelve_a_avisar_un_turno_reofrecido(
    client: AsyncClient, session_factory, monkeypatch
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    b, _b_id = await _trabajador(client, "reof_b_esc@staffya.com")
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(client, "esc")
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    tras_reoferta = len(await _avisos(client, b, "urgent_shift_nearby"))
    assert tras_reoferta >= 1

    await scheduler.run_escalation_check()

    assert len(await _avisos(client, b, "urgent_shift_nearby")) == tras_reoferta


# --- Dos acciones a la vez (ADR-0016) ---------------------------------------


@asyncio
async def test_la_ausencia_y_la_llegada_a_la_vez_no_reofrecen_un_turno_con_alguien_adentro(
    client: AsyncClient, session_factory
):
    """El comercio marca «No se presentó» mientras la persona marca la
    llegada, cada uno con su lectura: gana el primero y el otro choca. No
    puede quedar un turno reofrecido con la llegada marcada, ni con un monto
    prorrateado para quien confirmó a tiempo."""
    from app.modules.shift.domain.exceptions import ShiftConcurrentModificationError
    from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository

    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(client, "carrera")

    async with session_factory() as session_a, session_factory() as session_b:
        repo_a = SqlAlchemyShiftRepository(session_a)
        repo_b = SqlAlchemyShiftRepository(session_b)
        del_trabajador = await repo_a.get_by_id(UUID(shift_id))
        del_comercio = await repo_b.get_by_id(UUID(shift_id))

        del_trabajador.check_in(PALERMO["latitude"], PALERMO["longitude"])
        await repo_a.update(del_trabajador)

        assert del_comercio.no_show() is Reapertura.REOFRECIDO
        with pytest.raises(ShiftConcurrentModificationError):
            await repo_b.update(del_comercio)

    detail = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detail["status"] == "check_in"
    assert detail["reoffered_at"] is None
    assert detail["prorated_pay_amount"] is None


@asyncio
async def test_marcar_dos_veces_la_ausencia_reofrece_y_avisa_una_sola_vez(client: AsyncClient):
    b, _b_id = await _trabajador(client, "reof_b_doble@staffya.com")
    shift_id, comercio, a, _a_id = await _turno_confirmado_y_empezado(client, "doble")
    antes = len(await _avisos(client, b, "urgent_shift_nearby"))

    primera = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    segunda = await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)

    assert primera.status_code == 200
    assert segunda.status_code == 400
    assert len(await _avisos(client, b, "urgent_shift_nearby")) == antes + 1
    assert len(await _avisos(client, comercio, "shift_reopened")) == 1
    perfil_a = (await client.get("/api/v1/workers/me/profile", headers=a)).json()
    assert perfil_a["no_shows"] == 1


# --- Suspensión de la cuenta (ADR-0024) ------------------------------------


@asyncio
async def test_suspender_al_reemplazo_no_reofrece_y_sigue_hasta_la_ausencia(
    client: AsyncClient, session_factory, monkeypatch
):
    """Suspender a quien tomó un turno reofrecido no lo vuelve a reofrecer:
    ya empezó, y lo empezado no se toca (ADR-0024, punto 3). Sigue su curso
    hasta la ausencia automática, contada desde que confirmó, y ahí se
    reofrece si le quedan al menos dos horas."""
    from tests.conftest import make_admin

    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    admin = await make_admin(client, session_factory, "reof_admin_susp@staffya.com")
    b, b_id = await _trabajador(client, "reof_b_susp@staffya.com")
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(
        client, "susp", empezo_hace=timedelta(hours=2, minutes=30), horas=8
    )
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": b_id}
    )
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=b)).status_code == 200
    avisos_antes = len(await _avisos(client, comercio, "shift_reopened"))

    users = await client.get(
        "/api/v1/admin/users", headers=admin, params={"q": "reof_b_susp@staffya.com"}
    )
    user_id = next(u["id"] for u in users.json() if u["email"] == "reof_b_susp@staffya.com")
    suspended = await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin)
    assert suspended.status_code == 200, suspended.text

    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detalle["status"] == "confirmado"
    assert detalle["worker_profile_id"] == b_id
    assert len(await _avisos(client, comercio, "shift_reopened")) == avisos_antes

    # A las 2 horas de que confirmó: ausencia automática, y se reofrece.
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.confirmed_at = _now() - NO_SHOW_GRACE_PERIOD - timedelta(minutes=1)
        await session.commit()
    await scheduler.run_attendance_check()
    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detalle["status"] == "buscando_personal"
    assert detalle["worker_profile_id"] is None
    assert len(await _avisos(client, comercio, "shift_reopened")) == avisos_antes + 1


async def _turno_con_rechazado(
    client: AsyncClient, tag: str, *, empezo_hace: timedelta, horas: float = 4
) -> tuple[str, dict, str]:
    """Un turno común ya empezado, confirmado por A, con C postulado y
    rechazado al asignar a A."""
    comercio = await _comercio(client, f"reof_emp_{tag}@staffya.com")
    a, a_id = await _trabajador(client, f"reof_a_{tag}@staffya.com")
    c, c_id = await _trabajador(client, f"reof_c_{tag}@staffya.com")
    created = await client.post(
        "/api/v1/shifts", headers=comercio, json=_payload(_now() - empezo_hace, horas=horas)
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=comercio)
    for quien in (a, c):
        aplico = await client.post(f"/api/v1/applications/shifts/{shift_id}", headers=quien)
        assert aplico.status_code in (200, 201), aplico.text
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": a_id}
    )
    assert (await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=a)).status_code == 200
    return shift_id, comercio, c_id


async def _estado_de_postulacion(session_factory, shift_id: str, profile_id: str) -> str:
    from sqlalchemy import select

    from app.modules.application.infrastructure.models import ShiftApplicationModel

    async with session_factory() as session:
        row = (
            await session.execute(
                select(ShiftApplicationModel).where(
                    ShiftApplicationModel.shift_id == UUID(shift_id),
                    ShiftApplicationModel.worker_profile_id == UUID(profile_id),
                )
            )
        ).scalar_one()
        return row.status.value if hasattr(row.status, "value") else str(row.status)


async def _reabrir_por_suspension(session_factory, shift_id: str) -> None:
    """Llama directo a la reapertura por suspensión: por la API no se llega
    con un turno empezado (`shifts_taken_not_started`), pero el caso de uso
    tiene que respetar lo que decida `release_worker` si eso cambia."""
    async with session_factory() as session:
        service = scheduler._build_service(session)
        shift = await service._shifts.get_by_id(UUID(shift_id))
        await service._reopen_for_worker_suspension(shift)
        await session.commit()


@asyncio
async def test_la_reapertura_por_suspension_de_un_turno_empezado_lo_reofrece(
    client: AsyncClient, session_factory
):
    shift_id, comercio, c_id = await _turno_con_rechazado(
        client, "susp_reof", empezo_hace=timedelta(minutes=30)
    )
    assert await _estado_de_postulacion(session_factory, shift_id, c_id) == "rechazada"
    cerca, _ = await _trabajador(client, "reof_cerca_susp@staffya.com")
    antes = len(await _avisos(client, cerca, "urgent_shift_nearby"))

    await _reabrir_por_suspension(session_factory, shift_id)

    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detalle["status"] == "buscando_personal"
    assert detalle["reoffered_at"] is not None
    assert await _estado_de_postulacion(session_factory, shift_id, c_id) == "pendiente"
    aviso = (await _avisos(client, comercio, "shift_reopened"))[-1]
    assert "ya no puede tomarlo" in aviso["message"]
    assert "lo reofrecimos como urgente" in aviso["message"]
    assert len(await _avisos(client, cerca, "urgent_shift_nearby")) == antes + 1


@asyncio
async def test_la_reapertura_por_suspension_sin_una_hora_cierra_sin_restaurar(
    client: AsyncClient, session_factory
):
    shift_id, comercio, c_id = await _turno_con_rechazado(
        client, "susp_cierra", empezo_hace=timedelta(hours=3, minutes=30)
    )

    await _reabrir_por_suspension(session_factory, shift_id)

    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detalle["status"] == "no_cubierto"
    # Turno cerrado: ya no hay carrera a la que volver.
    assert await _estado_de_postulacion(session_factory, shift_id, c_id) == "rechazada"
    avisos = await _avisos(client, comercio, "shift_not_covered")
    assert len(avisos) == 1
    assert "ya no puede tomarlo" in avisos[0]["message"]
    assert await _avisos(client, comercio, "shift_reopened") == []


@asyncio
async def test_la_ficha_del_admin_muestra_lo_que_se_cobra(client: AsyncClient, session_factory):
    """La ficha del admin muestra lo que se cobra (`amount_due`), no sólo lo
    publicado: en un reofrecido con la llegada marcada, lo que restaba."""
    from tests.conftest import make_admin

    admin = await make_admin(client, session_factory, "reof_admin_ficha@staffya.com")
    b, b_id = await _trabajador(client, "reof_b_ficha@staffya.com")
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(client, "ficha")
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=comercio, json={"worker_profile_id": b_id}
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=b)
    checked = await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=b, json=PALERMO)
    fijo = Decimal(checked.json()["prorated_pay_amount"])

    users = await client.get(
        "/api/v1/admin/users", headers=admin, params={"q": "reof_b_ficha@staffya.com"}
    )
    user_id = next(u["id"] for u in users.json() if u["email"] == "reof_b_ficha@staffya.com")
    ficha = (await client.get(f"/api/v1/admin/users/{user_id}", headers=admin)).json()
    [fila] = [s for s in ficha["recent_shifts"] if s["id"] == shift_id]
    assert Decimal(fila["pay_amount"]) == Decimal("40000")
    assert Decimal(fila["amount_due"]) == fijo < Decimal("40000")


@asyncio
async def test_no_cubierto_con_una_foto_vieja_no_cierra_un_turno_reofrecido(
    client: AsyncClient, session_factory
):
    """Carrera: el scheduler leyó el turno cuando su plazo ya había vencido y,
    antes de actuar, el turno se reofreció (su plazo pasó a `offered_until`). El caso
    de uso relee el turno y, si todavía no corresponde, no hace nada."""
    shift_id, comercio, _a, _a_id = await _turno_confirmado_y_empezado(client, "carrera")
    await client.post(f"/api/v1/shifts/{shift_id}/no-show", headers=comercio)

    async with session_factory() as session:
        service = scheduler._build_service(session)
        resultado = await service.mark_not_covered(UUID(shift_id))
        await session.commit()

    assert resultado.status == ShiftStatus.BUSCANDO_PERSONAL
    detalle = (await client.get(f"/api/v1/shifts/{shift_id}", headers=comercio)).json()
    assert detalle["status"] == "buscando_personal"
    assert await _avisos(client, comercio, "shift_not_covered") == []
