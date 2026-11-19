"""CON-10 / ESC-04 (pasada 2026-11-19): «Marcar todas como leídas» marca sólo
lo que la persona tenía en pantalla.

Antes `POST /notifications/read-all` hacía un UPDATE de todo lo no leído de la
cuenta: marcaba un aviso que llegó mientras viajaba el pedido y los que no
entraron en los 50 que trae `GET /notifications`, avisos que la persona nunca
vio (p. ej. «Te asignaron un turno. Confirmá tu asistencia»)."""

from uuid import UUID

import pytest
from httpx import AsyncClient

from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from tests.test_notification import _employer_with_company, _shift_payload, _worker_with_profile

pytestmark = pytest.mark.asyncio


async def _publicar_turno(client: AsyncClient, employer: dict) -> str:
    created = await client.post("/api/v1/shifts", headers=employer, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=employer)
    return shift_id


async def _mis_avisos(client: AsyncClient, headers: dict, **params) -> list[dict]:
    return (await client.get("/api/v1/notifications", headers=headers, params=params)).json()


async def test_marcar_todo_no_marca_un_aviso_que_la_campanita_no_mostro(client: AsyncClient):
    employer = await _employer_with_company(client, "con10_emp@staffya.com")
    worker, profile_id = await _worker_with_profile(client, "con10_w@staffya.com")
    shift_id = await _publicar_turno(client, employer)

    # La campanita cargó su lista (lo que la persona ve).
    vistos = await _mis_avisos(client, worker)
    ids_vistos = [n["id"] for n in vistos if not n["read"]]
    assert ids_vistos

    # Mientras tanto le asignan un turno (el socket no se lo trajo todavía).
    await client.post(
        f"/api/v1/shifts/{shift_id}/assign",
        headers=employer,
        json={"worker_profile_id": profile_id},
    )

    # Toca «Marcar todas como leídas»: manda lo que mostró.
    respuesta = await client.post(
        "/api/v1/notifications/read-all", headers=worker, json={"ids": ids_vistos}
    )
    assert respuesta.status_code == 200
    assert respuesta.json() == {"marked": len(ids_vistos)}

    ahora = await _mis_avisos(client, worker)
    por_id = {n["id"]: n for n in ahora}
    assert all(por_id[i]["read"] for i in ids_vistos)
    asignado = [n for n in ahora if n["type"] == "shift_assigned"]
    assert asignado, [n["type"] for n in ahora]
    # El aviso que la persona nunca vio sigue sin leer.
    assert asignado[0]["read"] is False


async def test_con_mas_de_50_sin_leer_marca_solo_los_que_se_mostraron(
    client: AsyncClient, session_factory
):
    """`GET /notifications` trae 50: con más sin leer, los de más atrás no se
    mostraron y no se marcan."""
    worker, _ = await _worker_with_profile(client, "con10_muchos@staffya.com")
    yo = UUID((await client.get("/api/v1/auth/me", headers=worker)).json()["id"])
    async with session_factory() as session:
        repo = SqlAlchemyNotificationRepository(session)
        for n in range(55):
            await repo.add(
                Notification(
                    user_id=yo,
                    type=NotificationType.SHIFT_FINISHED,
                    title=f"Aviso {n}",
                    message="Hay un turno cerca",
                )
            )

    mostrados = await _mis_avisos(client, worker)  # límite por defecto: 50
    assert len(mostrados) == 50
    ids = [n["id"] for n in mostrados]

    respuesta = await client.post(
        "/api/v1/notifications/read-all", headers=worker, json={"ids": ids}
    )
    assert respuesta.json() == {"marked": 50}

    todos = await _mis_avisos(client, worker, limit=100)
    assert len(todos) >= 55
    assert sum(1 for n in todos if not n["read"]) == len(todos) - 50


async def test_los_ids_ajenos_o_inexistentes_no_marcan_nada(client: AsyncClient):
    employer = await _employer_with_company(client, "con10_aj_emp@staffya.com")
    mia, _ = await _worker_with_profile(client, "con10_aj_a@staffya.com")
    otra, _ = await _worker_with_profile(client, "con10_aj_b@staffya.com")
    await _publicar_turno(client, employer)
    de_otra = [n["id"] for n in await _mis_avisos(client, otra)]
    assert de_otra

    respuesta = await client.post(
        "/api/v1/notifications/read-all",
        headers=mia,
        json={"ids": [*de_otra, "00000000-0000-4000-8000-000000000000"]},
    )
    assert respuesta.status_code == 200
    assert respuesta.json() == {"marked": 0}
    assert not any(n["read"] for n in await _mis_avisos(client, otra))


async def test_una_lista_vacia_no_marca_nada(client: AsyncClient):
    employer = await _employer_with_company(client, "con10_vac_emp@staffya.com")
    worker, _ = await _worker_with_profile(client, "con10_vac_w@staffya.com")
    await _publicar_turno(client, employer)

    respuesta = await client.post(
        "/api/v1/notifications/read-all", headers=worker, json={"ids": []}
    )
    assert respuesta.json() == {"marked": 0}
    assert any(not n["read"] for n in await _mis_avisos(client, worker))


async def test_sin_cuerpo_marca_todo_como_el_cliente_viejo(client: AsyncClient):
    """Compatibilidad: la app que quedó en caché (PWA) no manda nada y su botón
    sigue marcando todo lo no leído. El cliente actual siempre manda `ids`."""
    employer = await _employer_with_company(client, "con10_old_emp@staffya.com")
    worker, _ = await _worker_with_profile(client, "con10_old_w@staffya.com")
    await _publicar_turno(client, employer)

    respuesta = await client.post("/api/v1/notifications/read-all", headers=worker)
    assert respuesta.status_code == 200
    assert respuesta.json()["marked"] >= 1
    assert all(n["read"] for n in await _mis_avisos(client, worker))


async def test_ids_con_forma_invalida_dan_422(client: AsyncClient):
    worker, _ = await _worker_with_profile(client, "con10_422_w@staffya.com")
    respuesta = await client.post(
        "/api/v1/notifications/read-all", headers=worker, json={"ids": ["no-es-un-id"]}
    )
    assert respuesta.status_code == 422
