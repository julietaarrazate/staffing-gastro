"""«¿Ya cobraste?»: la persona dice si cobró un turno terminado (2026-11-27).

Oído no mueve plata. Estas pruebas cubren la regla (dominio), el recorrido por
la API (permisos, plazos con el reloj, idempotencia, 404 de lo ajeno), los avisos
al comercio y el ticket de pagos que abre «Todavía no cobré"."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.modules.shift.domain.cobro import PLAZO_PARA_AVISAR_QUE_NO_COBRO, puede_avisar_desde
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.exceptions import PaymentReportNotAllowedError
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.worker.domain.value_objects import WorkerSkill
from tests._turno_empezado import correr_reloj_del_turno
from tests.conftest import make_admin
from tests.test_attendance import _employer_with_company, _shift_payload
from tests.test_attendance import _worker_with_profile as _worker_con_perfil

POS = {"latitude": -34.58, "longitude": -58.43}


# --- Dominio ------------------------------------------------------------------


def _turno(status: ShiftStatus, *, pagado: bool = False) -> Shift:
    fin = datetime(2026, 11, 20, 23, 0, tzinfo=timezone.utc)
    shift = Shift(
        company_id=uuid4(),
        position=WorkerSkill.MOZO,
        quantity=1,
        start_at=fin - timedelta(hours=5),
        end_at=fin,
        pay_amount=50000,
        currency="ARS",
        status=status,
        worker_profile_id=uuid4(),
    )
    if pagado:
        shift.paid_at = fin + timedelta(hours=1)
    return shift


def test_desde_cuando_se_puede_avisar():
    fin = datetime(2026, 11, 20, 23, 0, tzinfo=timezone.utc)
    assert puede_avisar_desde(fin, None) == fin + PLAZO_PARA_AVISAR_QUE_NO_COBRO
    assert PLAZO_PARA_AVISAR_QUE_NO_COBRO == timedelta(hours=24)
    # Con «pagado» del comercio vale desde ese momento, aunque el horario del
    # turno todavía no haya terminado.
    pago = fin - timedelta(hours=1)
    assert puede_avisar_desde(fin, pago) == pago


def test_solo_un_turno_terminado_admite_decir_si_cobro():
    for estado in (ShiftStatus.CONFIRMADO, ShiftStatus.TRABAJANDO, ShiftStatus.CHECK_OUT):
        turno = _turno(estado)
        with pytest.raises(PaymentReportNotAllowedError):
            turno.worker_confirm_payment()
        with pytest.raises(PaymentReportNotAllowedError):
            turno.worker_report_unpaid()
        assert turno.unpaid_report_opens_at is None


def test_si_cobre_es_definitivo_e_idempotente():
    turno = _turno(ShiftStatus.FINALIZADO)
    ahora = turno.end_at + timedelta(hours=1)
    assert turno.worker_confirm_payment(ahora) is True
    assert turno.worker_confirmed_paid_at == ahora
    assert turno.worker_confirm_payment(ahora + timedelta(days=1)) is False
    assert turno.worker_confirmed_paid_at == ahora
    # Ya cobró: no puede avisar que no.
    with pytest.raises(PaymentReportNotAllowedError):
        turno.worker_report_unpaid(ahora + timedelta(days=2))


def test_no_cobre_sin_pago_del_comercio_espera_24_horas_del_fin():
    turno = _turno(ShiftStatus.FINALIZADO)
    casi = turno.end_at + timedelta(hours=23, minutes=59)
    with pytest.raises(PaymentReportNotAllowedError) as error:
        turno.worker_report_unpaid(casi)
    assert "Todavía es pronto" in str(error.value)
    assert turno.worker_reported_unpaid_at is None
    justo = turno.end_at + timedelta(hours=24)
    assert turno.worker_report_unpaid(justo) is True
    assert turno.worker_reported_unpaid_at == justo


def test_no_cobre_con_pago_del_comercio_vale_en_cualquier_momento():
    turno = _turno(ShiftStatus.PAGADO, pagado=True)
    # Antes de que el comercio marcara «pagado» no había nada que contradecir.
    with pytest.raises(PaymentReportNotAllowedError):
        turno.worker_report_unpaid(turno.paid_at - timedelta(minutes=1))
    ahora = turno.paid_at + timedelta(minutes=5)
    assert turno.worker_report_unpaid(ahora) is True


def test_no_cobre_una_sola_vez_y_despues_puede_confirmar():
    turno = _turno(ShiftStatus.PAGADO, pagado=True)
    primera = turno.end_at + timedelta(hours=2)
    assert turno.worker_report_unpaid(primera) is True
    assert turno.worker_report_unpaid(primera + timedelta(days=3)) is False
    assert turno.worker_reported_unpaid_at == primera
    assert turno.worker_confirm_payment(primera + timedelta(days=4)) is True
    assert turno.worker_reported_unpaid_at == primera  # el registro queda


# --- API ----------------------------------------------------------------------


async def _turno_terminado(
    client: AsyncClient,
    tag: str,
    *,
    pagar: bool = False,
    session_factory=None,
    horas_desde_el_fin: float | None = None,
):
    """Turno recorrido hasta `finalizado` (o `pagado`). Con `horas_desde_el_fin`
    se corre el fin del turno al pasado, para probar los plazos."""
    employer = await _employer_with_company(client, f"cobro_{tag}_emp@staffya.com")
    start = (datetime.now(timezone.utc) + timedelta(minutes=10)).replace(tzinfo=None)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=start.isoformat(), end_at=(start + timedelta(hours=5)).isoformat()
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, worker_id = await _worker_con_perfil(client, f"cobro_{tag}_w@staffya.com")
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=employer, json={"worker_profile_id": worker_id}
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    llegada = await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=worker, json=POS)
    assert llegada.status_code == 200, llegada.text
    await correr_reloj_del_turno(shift_id, 60)
    salida = await client.post(f"/api/v1/shifts/{shift_id}/check-out", headers=worker, json=POS)
    assert salida.status_code == 200, salida.text
    assert (
        await client.post(f"/api/v1/shifts/{shift_id}/finish", headers=employer)
    ).status_code == 200
    if pagar:
        pago = await client.post(f"/api/v1/shifts/{shift_id}/mark-paid", headers=employer)
        assert pago.status_code == 200, pago.text
    if horas_desde_el_fin is not None:
        await _fin_hace(session_factory, shift_id, horas_desde_el_fin)
    return shift_id, employer, worker


async def _fin_hace(session_factory, shift_id: str, horas: float) -> None:
    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        assert model is not None
        fin = datetime.now(timezone.utc) - timedelta(hours=horas)
        model.end_at = fin
        model.start_at = fin - timedelta(hours=5)
        await session.commit()


def _url(shift_id: str, accion: str) -> str:
    return f"/api/v1/shifts/{shift_id}/{accion}"


async def _avisos(client: AsyncClient, headers: dict, tipo: str) -> list[dict]:
    todos = (await client.get("/api/v1/notifications", headers=headers)).json()
    return [a for a in todos if a["type"] == tipo]


@pytest.mark.asyncio
async def test_si_cobre_guarda_la_fecha_y_avisa_suave_al_comercio(client: AsyncClient):
    shift_id, employer, worker = await _turno_terminado(client, "si")
    respuesta = await client.post(_url(shift_id, "payment-received"), headers=worker)
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["worker_confirmed_paid_at"] is not None
    assert cuerpo["worker_reported_unpaid_at"] is None
    assert cuerpo["status"] == "finalizado"  # no cambia el estado ni marca «pagado»
    assert cuerpo["paid_at"] is None

    [aviso] = await _avisos(client, employer, "worker_confirmed_paid")
    assert "confirmó que cobró" in aviso["title"]
    assert aviso["link"] == f"/shifts?turno={shift_id}"
    # El comercio lo ve en su turno.
    visto = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert visto["worker_confirmed_paid_at"] == cuerpo["worker_confirmed_paid_at"]


@pytest.mark.asyncio
async def test_si_cobre_es_idempotente_y_no_repite_el_aviso(client: AsyncClient):
    shift_id, employer, worker = await _turno_terminado(client, "idem")
    primera = (await client.post(_url(shift_id, "payment-received"), headers=worker)).json()
    segunda = await client.post(_url(shift_id, "payment-received"), headers=worker)
    assert segunda.status_code == 200
    assert segunda.json()["worker_confirmed_paid_at"] == primera["worker_confirmed_paid_at"]
    assert len(await _avisos(client, employer, "worker_confirmed_paid")) == 1


@pytest.mark.asyncio
async def test_si_cobre_vale_aunque_el_comercio_ya_marco_pagado(client: AsyncClient):
    shift_id, _employer, worker = await _turno_terminado(client, "sipagado", pagar=True)
    respuesta = await client.post(_url(shift_id, "payment-received"), headers=worker)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["worker_confirmed_paid_at"] is not None
    assert respuesta.json()["status"] == "pagado"


@pytest.mark.asyncio
async def test_no_cobre_antes_de_las_24_horas_se_explica_cuando(
    client: AsyncClient, session_factory
):
    shift_id, employer, worker = await _turno_terminado(
        client, "pronto", session_factory=session_factory, horas_desde_el_fin=23
    )
    respuesta = await client.post(_url(shift_id, "payment-missing"), headers=worker)
    assert respuesta.status_code == 400
    assert "lo podés hacer desde el" in respuesta.json()["detail"]
    # La respuesta del turno dice desde cuándo.
    turno = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()
    assert turno["unpaid_report_opens_at"] is not None
    assert turno["worker_reported_unpaid_at"] is None
    assert await _avisos(client, employer, "worker_reported_unpaid") == []


@pytest.mark.asyncio
async def test_no_cobre_pasadas_las_24_horas_avisa_y_abre_ticket_de_pagos(
    client: AsyncClient, session_factory
):
    shift_id, employer, worker = await _turno_terminado(
        client, "no24", session_factory=session_factory, horas_desde_el_fin=25
    )
    respuesta = await client.post(_url(shift_id, "payment-missing"), headers=worker)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["worker_reported_unpaid_at"] is not None

    [aviso] = await _avisos(client, employer, "worker_reported_unpaid")
    assert aviso["message"].startswith("Test User avisó que todavía no cobró el turno del ")
    assert aviso["message"].endswith(
        ". Si ya le pagaste, pedile que lo confirme; si no, coordinalo por el chat."
    )

    mios = (await client.get("/api/v1/support/tickets/mine", headers=worker)).json()
    [ticket] = [t for t in mios if t["shift_id"] == shift_id]
    assert ticket["category"] == "pagos"
    assert ticket["status"] == "abierto"
    admin = await make_admin(client, session_factory, "admin_cobro@staffya.com")
    todos = (await client.get("/api/v1/support/tickets", headers=admin)).json()
    assert any(t["id"] == ticket["id"] for t in todos)


@pytest.mark.asyncio
async def test_no_cobre_con_el_pago_del_comercio_vale_enseguida_y_una_sola_vez(
    client: AsyncClient
):
    shift_id, employer, worker = await _turno_terminado(client, "nopagado", pagar=True)
    primera = await client.post(_url(shift_id, "payment-missing"), headers=worker)
    assert primera.status_code == 200, primera.text
    segunda = await client.post(_url(shift_id, "payment-missing"), headers=worker)
    assert segunda.status_code == 200
    assert (
        segunda.json()["worker_reported_unpaid_at"] == primera.json()["worker_reported_unpaid_at"]
    )
    assert len(await _avisos(client, employer, "worker_reported_unpaid")) == 1
    mios = (await client.get("/api/v1/support/tickets/mine", headers=worker)).json()
    assert len([t for t in mios if t["shift_id"] == shift_id]) == 1
    # Oído no sanciona: el turno sigue pagado y la fecha de pago del comercio, intacta.
    assert primera.json()["status"] == "pagado"
    assert primera.json()["paid_at"] is not None


@pytest.mark.asyncio
async def test_despues_de_avisar_que_no_cobro_puede_confirmar_y_ya_no_vuelve_atras(
    client: AsyncClient
):
    shift_id, _employer, worker = await _turno_terminado(client, "pasa", pagar=True)
    await client.post(_url(shift_id, "payment-missing"), headers=worker)
    confirmado = await client.post(_url(shift_id, "payment-received"), headers=worker)
    assert confirmado.status_code == 200
    assert confirmado.json()["worker_confirmed_paid_at"] is not None
    assert confirmado.json()["worker_reported_unpaid_at"] is not None
    de_nuevo = await client.post(_url(shift_id, "payment-missing"), headers=worker)
    assert de_nuevo.status_code == 400
    assert "Ya confirmaste" in de_nuevo.json()["detail"]


@pytest.mark.asyncio
async def test_turno_sin_terminar_no_admite_ninguna_de_las_dos(client: AsyncClient):
    employer = await _employer_with_company(client, "cobro_enmarcha_emp@staffya.com")
    start = (datetime.now(timezone.utc) + timedelta(minutes=10)).replace(tzinfo=None)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(
            start_at=start.isoformat(), end_at=(start + timedelta(hours=5)).isoformat()
        ),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, worker_id = await _worker_con_perfil(client, "cobro_enmarcha_w@staffya.com")
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign", headers=employer, json={"worker_profile_id": worker_id}
    )
    await client.post(f"/api/v1/shifts/{shift_id}/confirm", headers=worker)
    for accion in ("payment-received", "payment-missing"):
        respuesta = await client.post(_url(shift_id, accion), headers=worker)
        assert respuesta.status_code == 400, (accion, respuesta.text)


@pytest.mark.asyncio
async def test_lo_ajeno_o_inexistente_es_404(client: AsyncClient):
    shift_id, employer, _worker = await _turno_terminado(client, "ajeno", pagar=True)
    otra, _ = await _worker_con_perfil(client, "cobro_ajeno_otra@staffya.com")
    inexistente = "00000000-0000-0000-0000-000000000000"
    for accion in ("payment-received", "payment-missing"):
        assert (await client.post(_url(shift_id, accion), headers=otra)).status_code == 404
        assert (await client.post(_url(inexistente, accion), headers=otra)).status_code == 404
        # El comercio no es la persona: ni 404 ni 200, ni siquiera entra.
        assert (await client.post(_url(shift_id, accion), headers=employer)).status_code == 403
    # Y nada quedó registrado.
    turno = (await client.get(f"/api/v1/shifts/{shift_id}", headers=employer)).json()
    assert turno["worker_confirmed_paid_at"] is None
    assert turno["worker_reported_unpaid_at"] is None


@pytest.mark.asyncio
async def test_quien_no_es_parte_no_ve_lo_que_dijo_la_persona(client: AsyncClient):
    shift_id, _employer, worker = await _turno_terminado(client, "priv", pagar=True)
    await client.post(_url(shift_id, "payment-missing"), headers=worker)
    otro, _ = await _worker_con_perfil(client, "cobro_priv_otro@staffya.com")
    assert (await client.get(f"/api/v1/shifts/{shift_id}", headers=otro)).status_code == 404
    mine_otro = (await client.get("/api/v1/shifts/mine", headers=otro)).json()
    assert all(s["id"] != shift_id for s in mine_otro)
    # La propia persona sí lo ve en «Mis turnos».
    mios = (await client.get("/api/v1/shifts/mine", headers=worker)).json()
    [suyo] = [s for s in mios if s["id"] == shift_id]
    assert suyo["worker_reported_unpaid_at"] is not None


@pytest.mark.asyncio
async def test_reintento_con_la_misma_clave_repite_la_respuesta(client: AsyncClient):
    shift_id, employer, worker = await _turno_terminado(client, "clave", pagar=True)
    for accion, clave in (("payment-missing", "cobro-no"), ("payment-received", "cobro-si")):
        headers = {**worker, "Idempotency-Key": clave}
        primera = await client.post(_url(shift_id, accion), headers=headers)
        assert primera.status_code == 200, primera.text
        reintento = await client.post(_url(shift_id, accion), headers=headers)
        assert reintento.status_code == 200
        assert reintento.json() == primera.json()
    assert len(await _avisos(client, employer, "worker_reported_unpaid")) == 1
    assert len(await _avisos(client, employer, "worker_confirmed_paid")) == 1
