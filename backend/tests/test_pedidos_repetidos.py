"""Pedidos repetidos (pasada por clase de error, 2026-11-19: CON-01, CON-05,
CON-12 y CON-14). Con datos móviles flojos una respuesta se pierde y la
persona reintenta, o dos pantallas mandan lo mismo a la vez: ninguno de los
dos casos puede terminar en un error técnico ni en un 500."""

import pytest
from httpx import AsyncClient

from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.review.infrastructure.repositories import SqlAlchemyReviewRepository
from tests.test_attendance import (
    _confirmed_shift,
    _employer_with_company,
    _shift_payload,
    _worker_with_profile,
)
from tests.test_review import _shift_at_status

pytestmark = pytest.mark.asyncio

POSICION = {"latitude": -34.58, "longitude": -58.43}


async def _turno_asignado(client: AsyncClient, empleador: str, trabajador: str):
    employer = await _employer_with_company(client, empleador)
    worker, profile_id = await _worker_with_profile(client, trabajador)
    created = await client.post(
        "/api/v1/shifts",
        headers=employer,
        json=_shift_payload(start_at="2027-03-10T20:00:00", end_at="2027-03-11T03:00:00"),
    )
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )
    return shift_id, employer, worker


# CON-14: las rutas que el cliente manda con clave tienen que usarla.


async def test_reintentar_rechazar_con_la_misma_clave_repite_la_respuesta(client: AsyncClient):
    shift_id, _employer, worker = await _turno_asignado(
        client, "rep_rechazar_emp@staffya.com", "rep_rechazar_w@staffya.com"
    )
    headers = {**worker, "Idempotency-Key": "turno-rechazar"}
    primera = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=headers)
    assert primera.status_code == 200  # llegó; la respuesta se perdió

    reintento = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=headers)
    assert reintento.status_code == 200, reintento.json()
    assert reintento.json() == primera.json()


async def test_reintentar_cancelar_mi_asignacion_repite_la_respuesta(client: AsyncClient):
    shift_id, _employer, worker = await _confirmed_shift(
        client, "rep_cancelar_emp@staffya.com", "rep_cancelar_w@staffya.com"
    )
    headers = {**worker, "Idempotency-Key": "turno-cancelar-asignacion"}
    primera = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=headers)
    assert primera.status_code == 200

    reintento = await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=headers)
    assert reintento.status_code == 200, reintento.json()
    assert reintento.json() == primera.json()


async def test_reintentar_empezar_cerrar_y_pagar_repite_la_respuesta(client: AsyncClient):
    shift_id, employer, worker = await _confirmed_shift(
        client, "rep_cierre_emp@staffya.com", "rep_cierre_w@staffya.com"
    )
    await client.post(f"/api/v1/shifts/{shift_id}/depart", headers=worker)
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=worker, json=POSICION)

    pasos = [
        ("start-working", worker, "reintento-empezar", None),
        ("check-out", worker, "reintento-terminar", POSICION),
        ("finish", employer, "reintento-cerrar", None),
        ("mark-paid", employer, "reintento-pagar", None),
    ]
    for ruta, quien, clave, cuerpo in pasos:
        headers = {**quien, "Idempotency-Key": clave}
        primera = await client.post(f"/api/v1/shifts/{shift_id}/{ruta}", headers=headers, json=cuerpo)
        assert primera.status_code == 200, (ruta, primera.json())
        reintento = await client.post(
            f"/api/v1/shifts/{shift_id}/{ruta}", headers=headers, json=cuerpo
        )
        assert reintento.status_code == 200, (ruta, reintento.json())
        assert reintento.json() == primera.json(), ruta


async def test_un_error_de_negocio_no_quema_la_clave_de_rechazar(client: AsyncClient):
    """Sólo un éxito queda guardado: un rechazo que falló se puede reintentar."""
    shift_id, _employer, worker = await _turno_asignado(
        client, "rep_error_emp@staffya.com", "rep_error_w@staffya.com"
    )
    otra, _ = await _worker_with_profile(client, "rep_error_otra@staffya.com")
    headers = {**otra, "Idempotency-Key": "turno-rechazar-ajeno"}
    ajeno = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=headers)
    assert ajeno.status_code == 404
    de_nuevo = await client.post(f"/api/v1/shifts/{shift_id}/reject", headers=headers)
    assert de_nuevo.status_code == 404


# CON-01: el cliente reintenta con la posición del primer intento.


async def test_reintento_de_llegada_con_la_misma_posicion_repite_la_respuesta(
    client: AsyncClient,
):
    shift_id, _employer, worker = await _confirmed_shift(
        client, "rep_llegue_emp@staffya.com", "rep_llegue_w@staffya.com"
    )
    headers = {**worker, "Idempotency-Key": "reintento-llegue"}
    primera = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in", headers=headers, json=POSICION
    )
    assert primera.status_code == 200
    reintento = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in", headers=headers, json=POSICION
    )
    assert reintento.status_code == 200, reintento.json()
    assert reintento.json() == primera.json()


async def test_la_misma_clave_con_otra_posicion_sigue_siendo_un_pedido_distinto(
    client: AsyncClient,
):
    """Por eso el cliente guarda la posición del primer intento junto a la
    clave: el servidor no acepta la misma clave con otro cuerpo."""
    shift_id, _employer, worker = await _confirmed_shift(
        client, "rep_distinto_emp@staffya.com", "rep_distinto_w@staffya.com"
    )
    headers = {**worker, "Idempotency-Key": "reintento-llegue-otra-posicion"}
    await client.post(f"/api/v1/shifts/{shift_id}/check-in", headers=headers, json=POSICION)
    otra = await client.post(
        f"/api/v1/shifts/{shift_id}/check-in",
        headers=headers,
        json={"latitude": -34.580007, "longitude": -58.430004},
    )
    assert otra.status_code == 422


# CON-12: una clave nueva por intento nuevo ejecuta de verdad.


async def test_confirmar_de_nuevo_tras_una_reasignacion_con_clave_nueva_confirma(
    client: AsyncClient,
):
    shift_id, employer, worker = await _turno_asignado(
        client, "rep_reasigna_emp@staffya.com", "rep_reasigna_w@staffya.com"
    )
    profile = (await client.get("/api/v1/workers/me/profile", headers=worker)).json()["id"]
    primera = await client.post(
        f"/api/v1/shifts/{shift_id}/confirm",
        headers={**worker, "Idempotency-Key": "confirmar-primera-vez"},
    )
    assert primera.status_code == 200
    await client.post(f"/api/v1/shifts/{shift_id}/worker-cancel", headers=worker)
    reasignado = await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile},
    )
    assert reasignado.status_code == 200, reasignado.json()

    # El cliente descarta la clave del intento terminado: la nueva ejecuta.
    segunda = await client.post(
        f"/api/v1/shifts/{shift_id}/confirm",
        headers={**worker, "Idempotency-Key": "confirmar-segunda-vez"},
    )
    assert segunda.status_code == 200
    estado = (await client.get(f"/api/v1/shifts/{shift_id}", headers=worker)).json()["status"]
    assert estado == "confirmado"


# CON-05: dos pedidos a la vez no dan 500.


async def test_dos_postulaciones_a_la_vez_dan_409_y_no_500(client: AsyncClient, monkeypatch):
    employer = await _employer_with_company(client, "rep_post_emp@staffya.com")
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    worker, _ = await _worker_with_profile(client, "rep_post_w@staffya.com")

    original_add = SqlAlchemyShiftApplicationRepository.add
    otra_ya_entro = False

    async def add(self, application):
        # La primera ya leyó «no hay postulación»; justo antes de insertar
        # entra la otra (desde otra pantalla) y termina.
        nonlocal otra_ya_entro
        if not otra_ya_entro:
            otra_ya_entro = True
            otra = await client.post(
                f"/api/v1/applications/shifts/{shift_id}",
                headers={**worker, "Idempotency-Key": "postular-desde-el-mapa"},
            )
            assert otra.status_code == 201
        return await original_add(self, application)

    monkeypatch.setattr(SqlAlchemyShiftApplicationRepository, "add", add)
    primera = await client.post(
        f"/api/v1/applications/shifts/{shift_id}",
        headers={**worker, "Idempotency-Key": "postular-desde-el-inicio"},
    )
    assert primera.status_code == 409, primera.json()
    assert primera.json()["detail"] == "Ya te postulaste a este turno"

    # La sesión de la base quedó usable: el pedido siguiente anda.
    mias = await client.get("/api/v1/applications/mine", headers=worker)
    assert mias.status_code == 200
    assert len(mias.json()) == 1


async def test_dos_calificaciones_a_la_vez_dan_409_y_no_500(client: AsyncClient, monkeypatch):
    shift_id, employer, _worker, _ = await _shift_at_status(
        client, "rep_resena_emp@staffya.com", "rep_resena_w@staffya.com", "pagado"
    )

    original_add = SqlAlchemyReviewRepository.add
    otra_ya_entro = False

    async def add(self, review):
        nonlocal otra_ya_entro
        if not otra_ya_entro:
            otra_ya_entro = True
            otra = await client.post(
                f"/api/v1/reviews/shifts/{shift_id}",
                headers=employer,
                json={"rating": 5, "comment": "Muy bien"},
            )
            assert otra.status_code == 201, otra.json()
        return await original_add(self, review)

    monkeypatch.setattr(SqlAlchemyReviewRepository, "add", add)
    primera = await client.post(
        f"/api/v1/reviews/shifts/{shift_id}",
        headers=employer,
        json={"rating": 4, "comment": "Bien"},
    )
    assert primera.status_code == 409, primera.json()

    # La sesión de la base quedó usable.
    lista = await client.get(f"/api/v1/reviews/shifts/{shift_id}", headers=employer)
    assert lista.status_code == 200
    assert len(lista.json()) == 1
