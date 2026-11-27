"""`GET /shifts/public-index`: los turnos con página pública indexable, para el
mapa del sitio (`frontend/app/sitemap.ts`). Sólo `id` y `published_at`.

La regla es un subconjunto de la de `GET /shifts/{id}/public`: lo que ese
endpoint contesta con 404 o 410, éste no lo lista.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.modules.shift.infrastructure.models import ShiftModel
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from app.modules.shift.application.services import ShiftService
from tests.conftest import make_admin
from tests.test_shift import (
    _employer_with_company,
    _shift_payload,
    _worker_with_profile,
)

pytestmark = pytest.mark.asyncio

URL = "/api/v1/shifts/public-index"


async def _crear(client: AsyncClient, headers: dict, *, publicar: bool = True, **over) -> str:
    created = await client.post("/api/v1/shifts", headers=headers, json=_shift_payload(**over))
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    if publicar:
        pub = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
        assert pub.status_code == 200, pub.text
    return shift_id


async def _ids(client: AsyncClient) -> list[str]:
    resp = await client.get(URL)
    assert resp.status_code == 200
    return [item["id"] for item in resp.json()]


async def test_lista_sin_sesion_solo_id_y_fecha_de_publicacion(client: AsyncClient):
    headers = await _employer_with_company(client, "idx_basico@staffya.com")
    shift_id = await _crear(client, headers)

    resp = await client.get(URL)

    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "public, max-age=300"
    [item] = resp.json()
    assert set(item) == {"id", "published_at"}
    assert item["id"] == shift_id
    assert item["published_at"] is not None


async def test_no_lista_borradores_cancelados_ni_tomados(client: AsyncClient):
    emp = await _employer_with_company(client, "idx_estados@staffya.com")
    abierto = await _crear(client, emp)
    await _crear(client, emp, publicar=False)  # borrador
    cancelado = await _crear(client, emp)
    await client.post(f"/api/v1/shifts/{cancelado}/cancel", headers=emp)
    tomado = await _crear(client, emp)
    _, worker_profile_id = await _worker_with_profile(client, "idx_w@staffya.com")
    asignado = await client.post(
        f"/api/v1/shifts/{tomado}/assign", headers=emp, json={"worker_profile_id": worker_profile_id}
    )
    assert asignado.status_code == 200

    assert await _ids(client) == [abierto]


async def test_no_lista_el_que_ya_empezo(client: AsyncClient, session_factory):
    emp = await _employer_with_company(client, "idx_empezo@staffya.com")
    futuro = await _crear(client, emp)
    empezado = await _crear(client, emp)
    ahora = datetime.now(timezone.utc)
    async with session_factory() as session:
        await session.execute(
            update(ShiftModel)
            .where(ShiftModel.id == empezado)
            .values(start_at=ahora - timedelta(hours=1), end_at=ahora + timedelta(hours=5))
        )
        await session.commit()

    assert await _ids(client) == [futuro]


async def test_no_lista_comercios_suspendidos_y_vuelve_al_reactivar(
    client: AsyncClient, session_factory
):
    emp = await _employer_with_company(client, "idx_susp@staffya.com")
    shift_id = await _crear(client, emp)
    admin = await make_admin(client, session_factory, "idx_admin@staffya.com")
    users = await client.get("/api/v1/admin/users", headers=admin, params={"q": "idx_susp@staffya.com"})
    user_id = next(u["id"] for u in users.json() if u["email"] == "idx_susp@staffya.com")

    assert (await client.post(f"/api/v1/admin/users/{user_id}/suspend", headers=admin)).status_code == 200
    assert await _ids(client) == []
    assert (await client.get(f"/api/v1/shifts/{shift_id}/public")).status_code == 410

    assert (await client.post(f"/api/v1/admin/users/{user_id}/activate", headers=admin)).status_code == 200
    assert await _ids(client) == [shift_id]


async def test_mas_nuevos_primero_y_con_tope(client: AsyncClient, session_factory):
    emp = await _employer_with_company(client, "idx_orden@staffya.com")
    primero = await _crear(client, emp)
    segundo = await _crear(client, emp)
    tercero = await _crear(client, emp)
    base = datetime.now(timezone.utc) - timedelta(days=1)
    async with session_factory() as session:
        for i, sid in enumerate([primero, segundo, tercero]):
            await session.execute(
                update(ShiftModel).where(ShiftModel.id == sid).values(published_at=base + timedelta(hours=i))
            )
        await session.commit()

    assert await _ids(client) == [tercero, segundo, primero]

    assert [s.id for s in await _con_tope(session_factory, 2)] == [UUID(tercero), UUID(segundo)]


async def test_todo_lo_listado_da_200_en_la_pagina_publica(client: AsyncClient):
    emp = await _employer_with_company(client, "idx_paridad@staffya.com")
    await _crear(client, emp)
    await _crear(client, emp, urgent=False)
    for shift_id in await _ids(client):
        assert (await client.get(f"/api/v1/shifts/{shift_id}/public")).status_code == 200


async def _con_tope(session_factory, limite: int):
    async with session_factory() as session:
        return await SqlAlchemyShiftRepository(session).list_public_index(limit=limite)


async def test_la_ruta_pasa_el_tope_de_1000_al_servicio(client: AsyncClient, monkeypatch):
    recibido = {}

    async def falso(self, limit: int = 0):
        recibido["limit"] = limit
        return []

    monkeypatch.setattr(ShiftService, "list_public_index", falso)

    assert await _ids(client) == []
    assert recibido["limit"] == 1000


async def test_limite_por_ip_30_por_minuto(client: AsyncClient):
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        codes = [(await client.get(URL)).status_code for _ in range(31)]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    assert codes[:30] == [200] * 30 and codes[30] == 429
