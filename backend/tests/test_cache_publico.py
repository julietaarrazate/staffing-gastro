"""Cache-Control de los GET públicos (2026-10-23).

- `/subscription/plans/public`: configuración igual para todos, sin base de
  datos → cacheable 5 minutos.
- `/shifts/{id}/public`: un turno se cubre en minutos y desde ahí da 410 («ya
  no disponible») → sin caché (la página compartida ya tiene su caché corta en
  el borde).
"""

from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.test_shift import _employer_with_company, _shift_payload


async def test_planes_publicos_se_cachean_5_minutos(client: AsyncClient):
    response = await client.get("/api/v1/subscription/plans/public")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=300"


async def test_planes_con_sesion_no_se_cachean_como_publicos(client: AsyncClient):
    headers = await auth_headers(client, "employer", "emp_cache_plans@staffya.com")
    response = await client.get("/api/v1/subscription/plans", headers=headers)
    assert response.status_code == 200
    assert "public" not in response.headers.get("cache-control", "")


async def test_turno_publico_no_se_cachea(client: AsyncClient):
    headers = await _employer_with_company(client, "emp_cache_pub@staffya.com")
    created = await client.post("/api/v1/shifts", headers=headers, json=_shift_payload())
    shift_id = created.json()["id"]
    await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)

    response = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"

    # Cubierto/cancelado: «ya no disponible» (410), también sin caché. Un 410
    # se puede guardar por defecto en cachés intermedias, y un turno asignado
    # puede volver a abrirse: la copia vieja lo mostraría cerrado.
    await client.post(f"/api/v1/shifts/{shift_id}/cancel", headers=headers)
    gone = await client.get(f"/api/v1/shifts/{shift_id}/public")
    assert gone.status_code == 410
    assert gone.headers["cache-control"] == "no-cache"
