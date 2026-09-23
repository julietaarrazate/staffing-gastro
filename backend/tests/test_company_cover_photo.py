"""Foto del local (`cover_photo_url`): la imagen grande de las tarjetas.

Lo que más importa cuidar no es que se guarde, sino que NO se borre sola: la
edición del perfil es de reemplazo total y hay escritores que no conocen el
campo (el onboarding de /bienvenida, una PWA vieja cacheada). Omitirlo tiene
que dejarla como estaba; mandarla en null, sacarla.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

FOTO = "https://res.cloudinary.com/demo/image/upload/salon.jpg"


async def _comercio(client: AsyncClient, email: str, **extra) -> dict:
    headers = await auth_headers(client, "employer", email)
    created = await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Café Gorriti", "city": "Palermo", **extra},
    )
    assert created.status_code == 201
    return headers


async def test_se_guarda_y_se_devuelve(client: AsyncClient):
    headers = await _comercio(client, "cover1@staffya.com", cover_photo_url=FOTO)
    me = await client.get("/api/v1/companies/me/profile", headers=headers)
    assert me.json()["cover_photo_url"] == FOTO


async def test_editar_sin_mandarla_no_la_borra(client: AsyncClient):
    headers = await _comercio(client, "cover2@staffya.com", cover_photo_url=FOTO)
    # Mismo payload que manda /bienvenida: no sabe que existe la foto.
    updated = await client.put(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Café Gorriti", "city": "Palermo", "logo_url": None},
    )
    assert updated.status_code == 200
    assert updated.json()["cover_photo_url"] == FOTO


async def test_mandarla_en_null_la_saca(client: AsyncClient):
    headers = await _comercio(client, "cover3@staffya.com", cover_photo_url=FOTO)
    updated = await client.put(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Café Gorriti", "cover_photo_url": None},
    )
    assert updated.json()["cover_photo_url"] is None


async def test_el_trabajador_la_ve_en_el_feed(client: AsyncClient):
    headers = await _comercio(client, "cover4@staffya.com", cover_photo_url=FOTO)
    start = datetime.now(timezone.utc) + timedelta(hours=3)
    published = await client.post(
        "/api/v1/shifts",
        headers=headers,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": start.replace(tzinfo=None).isoformat(),
            "end_at": (start + timedelta(hours=6)).replace(tzinfo=None).isoformat(),
            "pay_amount": "45000.00",
            "city": "Palermo",
        },
    )
    assert published.status_code == 201
    await client.post(f"/api/v1/shifts/{published.json()['id']}/publish", headers=headers)
    worker = await auth_headers(client, "worker", "cover_w@staffya.com")
    await client.post("/api/v1/workers/me/profile", headers=worker, json={"skills": ["mozo"]})

    feed = await client.get("/api/v1/shifts/feed", headers=worker)
    shift = next(s for s in feed.json() if s["id"] == published.json()["id"])
    assert shift["company_cover_url"] == FOTO
