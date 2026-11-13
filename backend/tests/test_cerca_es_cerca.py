"""«Cerca» es cerca de verdad (prueba de punta a punta, 2026-11).

Dos causas hermanas que dejaban pasar turnos de otra provincia:

1. Avisos: el radio sólo puntuaba. Con pocos candidatos, quien estaba a
   más de 1.000 km recibía «Turno cerca tuyo» (campanita y push), después
   el «¡Urgente!» de la escalada, y salía como recomendado para el comercio.
2. Listas: `GET /shifts/feed` traía los 50 más nuevos de todo el país,
   urgentes primero. Como todo turno sin cubrir pasa a urgente a los 8
   minutos, con más de 50 abiertos uno nuevo y cercano quedaba afuera, y en
   «Cerca tuyo» aparecía uno de otra provincia.

El dominio puro del radio se prueba en `test_matching_scoring.py`; acá va lo
que cruza la API: el feed, los avisos, el push y los recomendados.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.geo import haversine_km
from app.modules.notification.infrastructure.fake_push_sender import FakePushSender
from app.modules.notification.infrastructure.push_tasks import drain_pending_pushes
from app.modules.shift.application import scheduler
from app.modules.shift.application.services import ESCALATION_DELAY
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.shift.infrastructure.models import ShiftModel
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio

# Lugares públicos (centro de cada ciudad), no domicilios.
PALERMO = (-34.5800, -58.4300)
CORDOBA = (-31.4201, -64.1888)  # a ~650 km de Palermo
BAHIA_BLANCA = (-38.7183, -62.2663)
TUCUMAN = (-26.8083, -65.2176)  # a ~1.350 km de Bahía Blanca

KM_PER_DEGREE_LAT = 111.19


def _north_of(point: tuple[float, float], km: float) -> tuple[float, float]:
    """Un punto `km` kilómetros al norte de `point` (misma longitud)."""
    return (point[0] + km / KM_PER_DEGREE_LAT, point[1])


def _future(minutes: int = 30) -> tuple[str, str]:
    start = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    end = start + timedelta(hours=6)
    return (
        start.replace(tzinfo=None).isoformat(),
        end.replace(tzinfo=None).isoformat(),
    )


async def _employer(
    client: AsyncClient, email: str, *, city: str, at: tuple[float, float] | None
) -> dict:
    headers = await auth_headers(client, "employer", email)
    payload: dict = {"name": f"Bar de {city}", "city": city}
    if at is not None:
        payload.update(latitude=at[0], longitude=at[1])
    await client.post("/api/v1/companies/me/profile", headers=headers, json=payload)
    return headers


async def _worker(
    client: AsyncClient,
    email: str,
    *,
    at: tuple[float, float] | None = None,
    city: str | None = None,
    skills: tuple[str, ...] = ("mozo",),
) -> dict:
    headers = await auth_headers(client, "worker", email)
    payload: dict = {"skills": list(skills), "is_available": True}
    if at is not None:
        payload.update(latitude=at[0], longitude=at[1])
    if city is not None:
        payload["city"] = city
    created = await client.post("/api/v1/workers/me/profile", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    return headers


async def _publish(
    client: AsyncClient,
    headers: dict,
    *,
    at: tuple[float, float] | None,
    city: str | None = None,
    urgent: bool = False,
    position: str = "mozo",
) -> str:
    start_at, end_at = _future()
    payload: dict = {
        "position": position,
        "quantity": 1,
        "start_at": start_at,
        "end_at": end_at,
        "pay_amount": "70000.00",
        "urgent": urgent,
    }
    if at is not None:
        payload.update(latitude=at[0], longitude=at[1])
    if city is not None:
        payload["city"] = city
    created = await client.post("/api/v1/shifts", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    shift_id = created.json()["id"]
    published = await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)
    assert published.status_code == 200, published.text
    return shift_id


async def _company_id(client: AsyncClient, headers: dict) -> UUID:
    me = await client.get("/api/v1/companies/me/profile", headers=headers)
    return UUID(me.json()["id"])


async def _seed_open_shifts(
    session_factory: async_sessionmaker[AsyncSession],
    company_id: UUID,
    points: list[tuple[float, float]],
    *,
    city: str,
    urgent: bool = True,
    position: str = "mozo",
) -> list[str]:
    """Deja turnos abiertos directo en la base (uno por punto), ya publicados
    y con fecha de creación vieja. Para simular un mercado con muchos turnos
    sin gastar cupo del plan ni cientos de requests."""
    now = datetime.now(timezone.utc)
    ids: list[str] = []
    async with session_factory() as session:
        for index, (lat, lng) in enumerate(points):
            model = ShiftModel(
                company_id=company_id,
                position=position,
                quantity=1,
                start_at=now + timedelta(hours=2),
                end_at=now + timedelta(hours=8),
                pay_amount=Decimal("70000.00"),
                urgent=urgent,
                city=city,
                latitude=lat,
                longitude=lng,
                status=ShiftStatus.PUBLICADO.value,
                published_at=now - timedelta(minutes=20),
                # Todos más NUEVOS que el turno cercano del test: así, si el
                # corte fuera por fecha, el cercano quedaría afuera.
                created_at=now + timedelta(seconds=index + 1),
            )
            session.add(model)
            await session.flush()
            ids.append(str(model.id))
        await session.commit()
    return ids


async def _feed(client: AsyncClient, headers: dict, **params) -> list[dict]:
    response = await client.get("/api/v1/shifts/feed", headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def _avisos(client: AsyncClient, headers: dict) -> list[str]:
    response = await client.get("/api/v1/notifications", headers=headers)
    return [n["type"] for n in response.json()]


async def _subscribe_to_push(client: AsyncClient, headers: dict, device: str) -> str:
    """Suscribe un dispositivo a push y devuelve el id de la cuenta."""
    await client.post(
        "/api/v1/push/subscribe",
        headers=headers,
        json={
            "endpoint": f"https://fcm.googleapis.com/fcm/send/{device}",
            "keys": {"p256dh": "p", "auth": "a"},
        },
    )
    me = await client.get("/api/v1/auth/me", headers=headers)
    return me.json()["id"]


# --- Listas: el feed del Inicio y del Mapa ----------------------------------


async def test_feed_muestra_el_turno_nuevo_y_cercano_con_mas_de_50_abiertos_lejos(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """El caso de la prueba: más de 50 urgentes abiertos en otra provincia y
    uno nuevo, sin marcar urgente, a 1 km. Antes la página de 50 se llenaba
    con los urgentes y el cercano no lo veía nadie."""
    lejos = await _employer(client, "cerca_feed_lejos@staffya.com", city="Córdoba", at=CORDOBA)
    await _seed_open_shifts(
        session_factory,
        await _company_id(client, lejos),
        [_north_of(CORDOBA, i * 0.1) for i in range(55)],
        city="Córdoba",
    )
    cerca = await _employer(client, "cerca_feed_cerca@staffya.com", city="Palermo", at=PALERMO)
    turno_cercano = await _publish(client, cerca, at=_north_of(PALERMO, 1), city="Palermo")

    worker = await _worker(client, "cerca_feed_w@staffya.com", at=PALERMO, city="Palermo")
    feed = await _feed(client, worker)

    assert [s["id"] for s in feed] == [turno_cercano]


async def test_turno_a_600_km_no_aparece_en_el_feed_y_si_en_buscar(client: AsyncClient):
    """«Cerca tuyo» no puede mostrar un turno de otra provincia. Buscar
    (`scope=all`) es la pantalla para mirar otras zonas: ahí sí aparece."""
    lejos = await _employer(client, "cerca_600_lejos@staffya.com", city="Córdoba", at=CORDOBA)
    turno_lejano = await _publish(client, lejos, at=CORDOBA, city="Córdoba", urgent=True)
    cerca = await _employer(client, "cerca_600_cerca@staffya.com", city="Palermo", at=PALERMO)
    turno_cercano = await _publish(client, cerca, at=PALERMO, city="Palermo")
    assert haversine_km(*PALERMO, *CORDOBA) > 600

    worker = await _worker(client, "cerca_600_w@staffya.com", at=PALERMO, city="Palermo")

    feed_ids = [s["id"] for s in await _feed(client, worker)]
    assert feed_ids == [turno_cercano]

    buscar_ids = [s["id"] for s in await _feed(client, worker, scope="all")]
    assert set(buscar_ids) == {turno_cercano, turno_lejano}
    # Con ubicación, Buscar ordena por distancia: lo de acá antes que lo de allá,
    # aunque lo de allá sea urgente.
    assert buscar_ids == [turno_cercano, turno_lejano]


async def test_feed_corta_en_el_radio_maximo(client: AsyncClient):
    """El radio del feed es el de la escalada (40 km): a 39 km entra, a 41 no."""
    employer = await _employer(client, "cerca_borde@staffya.com", city="Palermo", at=PALERMO)
    await client.post(
        "/api/v1/subscription/subscribe", headers=employer, json={"plan_code": "pro"}
    )
    adentro = await _publish(client, employer, at=_north_of(PALERMO, 39), city="Zona norte")
    afuera = await _publish(client, employer, at=_north_of(PALERMO, 41), city="Zona norte")

    worker = await _worker(client, "cerca_borde_w@staffya.com", at=PALERMO, city="Palermo")
    feed_ids = [s["id"] for s in await _feed(client, worker)]

    assert adentro in feed_ids
    assert afuera not in feed_ids


async def test_feed_ordena_urgentes_primero_y_despues_por_distancia(client: AsyncClient):
    employer = await _employer(client, "cerca_orden@staffya.com", city="Palermo", at=PALERMO)
    await client.post(
        "/api/v1/subscription/subscribe", headers=employer, json={"plan_code": "pro"}
    )
    comun_a_1 = await _publish(client, employer, at=_north_of(PALERMO, 1))
    urgente_a_20 = await _publish(client, employer, at=_north_of(PALERMO, 20), urgent=True)
    urgente_a_5 = await _publish(client, employer, at=_north_of(PALERMO, 5), urgent=True)
    comun_a_10 = await _publish(client, employer, at=_north_of(PALERMO, 10))

    worker = await _worker(client, "cerca_orden_w@staffya.com", at=PALERMO, city="Palermo")
    feed_ids = [s["id"] for s in await _feed(client, worker)]

    assert feed_ids == [urgente_a_5, urgente_a_20, comun_a_1, comun_a_10]


async def test_con_mas_de_50_dentro_del_radio_el_corte_es_por_cercania(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Una ciudad con más de 50 urgentes abiertos dentro del radio: el turno
    nuevo que está a 1 km tiene que seguir entrando. El corte de la página es
    por cercanía; adentro de la página, urgentes primero."""
    employer = await _employer(client, "cerca_densa@staffya.com", city="Palermo", at=PALERMO)
    await _seed_open_shifts(
        session_factory,
        await _company_id(client, employer),
        [_north_of(PALERMO, 10 + i * 0.2) for i in range(55)],
        city="Palermo",
    )
    turno_cercano = await _publish(client, employer, at=_north_of(PALERMO, 1), city="Palermo")

    worker = await _worker(client, "cerca_densa_w@staffya.com", at=PALERMO, city="Palermo")
    feed = await _feed(client, worker)

    assert len(feed) == 50
    assert turno_cercano in [s["id"] for s in feed]
    # Urgentes primero dentro de lo que se devuelve: el cercano, que no es
    # urgente, va al final.
    assert feed[-1]["id"] == turno_cercano
    assert all(s["urgent"] for s in feed[:-1])


async def test_feed_sin_ubicacion_filtra_por_la_ciudad_del_perfil(client: AsyncClient):
    """Perfil sin coordenadas pero con ciudad: se compara la ciudad, sin
    mayúsculas ni tildes."""
    cordoba = await _employer(client, "cerca_ciudad_cba@staffya.com", city="Córdoba", at=CORDOBA)
    en_su_ciudad = await _publish(client, cordoba, at=CORDOBA, city="CORDOBA ")
    palermo = await _employer(client, "cerca_ciudad_pal@staffya.com", city="Palermo", at=PALERMO)
    en_otra = await _publish(client, palermo, at=PALERMO, city="Palermo")

    worker = await _worker(client, "cerca_ciudad_w@staffya.com", city="Córdoba")
    feed_ids = [s["id"] for s in await _feed(client, worker)]

    assert feed_ids == [en_su_ciudad]
    assert en_otra in [s["id"] for s in await _feed(client, worker, scope="all")]


async def test_feed_sin_zona_en_el_perfil_muestra_todo_como_antes(client: AsyncClient):
    """Sin coordenadas ni ciudad no hay con qué decidir qué es cerca: se
    muestra todo, como siempre (y lo mismo para quien no es trabajador)."""
    cordoba = await _employer(client, "cerca_nada_cba@staffya.com", city="Córdoba", at=CORDOBA)
    uno = await _publish(client, cordoba, at=CORDOBA, city="Córdoba")
    palermo = await _employer(client, "cerca_nada_pal@staffya.com", city="Palermo", at=PALERMO)
    otro = await _publish(client, palermo, at=PALERMO, city="Palermo")

    worker = await _worker(client, "cerca_nada_w@staffya.com")
    assert {s["id"] for s in await _feed(client, worker)} == {uno, otro}
    assert {s["id"] for s in await _feed(client, cordoba)} == {uno, otro}


async def test_feed_incluye_el_turno_sin_coordenadas_de_la_misma_ciudad(client: AsyncClient):
    """Un turno sin coordenadas no se puede medir: entra si su ciudad es la
    del perfil, y no entra si es de otra. (El que no tiene ni ciudad se mide
    desde el local: más abajo, «Turno publicado sin zona».)"""
    employer = await _employer(client, "cerca_sin_coords@staffya.com", city="Palermo", at=None)
    misma_ciudad = await _publish(client, employer, at=None, city="palermo")
    otra_ciudad = await _publish(client, employer, at=None, city="Rosario")

    worker = await _worker(client, "cerca_sin_coords_w@staffya.com", at=PALERMO, city="Palermo")
    feed_ids = [s["id"] for s in await _feed(client, worker)]

    assert feed_ids == [misma_ciudad]
    assert otra_ciudad in {s["id"] for s in await _feed(client, worker, scope="all")}


async def test_feed_desde_un_punto_de_busqueda(client: AsyncClient):
    """La búsqueda del asistente («turnos en Córdoba») manda el punto de la
    zona pedida: «cerca» se mide desde ahí y no desde la zona del perfil."""
    cordoba = await _employer(client, "cerca_punto_cba@staffya.com", city="Córdoba", at=CORDOBA)
    en_cordoba = await _publish(client, cordoba, at=CORDOBA, city="Córdoba")
    palermo = await _employer(client, "cerca_punto_pal@staffya.com", city="Palermo", at=PALERMO)
    en_palermo = await _publish(client, palermo, at=PALERMO, city="Palermo")

    worker = await _worker(client, "cerca_punto_w@staffya.com", at=PALERMO, city="Palermo")
    desde_cordoba = await _feed(client, worker, latitude=CORDOBA[0], longitude=CORDOBA[1])
    assert [s["id"] for s in desde_cordoba] == [en_cordoba]

    todo_desde_cordoba = await _feed(
        client, worker, scope="all", latitude=CORDOBA[0], longitude=CORDOBA[1]
    )
    assert [s["id"] for s in todo_desde_cordoba] == [en_cordoba, en_palermo]


async def test_buscar_trae_lo_mas_cercano_aunque_haya_mas_de_50_abiertos(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
):
    """Buscar sigue teniendo un tope de 50 por pedido, pero con ubicación el
    tope se llena por cercanía: lo que está a la vuelta no queda afuera."""
    lejos = await _employer(client, "cerca_buscar_lejos@staffya.com", city="Córdoba", at=CORDOBA)
    await _seed_open_shifts(
        session_factory,
        await _company_id(client, lejos),
        [_north_of(CORDOBA, i * 0.1) for i in range(55)],
        city="Córdoba",
    )
    cerca = await _employer(client, "cerca_buscar_cerca@staffya.com", city="Palermo", at=PALERMO)
    turno_cercano = await _publish(client, cerca, at=_north_of(PALERMO, 1), city="Palermo")

    worker = await _worker(client, "cerca_buscar_w@staffya.com", at=PALERMO, city="Palermo")
    buscar = await _feed(client, worker, scope="all")

    assert len(buscar) == 50
    assert turno_cercano in [s["id"] for s in buscar]


# --- Avisos: campanita, push, escalada y recomendados -----------------------


async def test_publicar_no_avisa_ni_manda_push_a_quien_esta_fuera_del_radio(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    """El caso de la prueba: un bar de Bahía Blanca publica y a una
    trabajadora de Tucumán (a más de 1.300 km) le llegaba «Turno cerca tuyo»."""
    cerca = await _worker(client, "aviso_cerca@staffya.com", at=_north_of(BAHIA_BLANCA, 2))
    lejos = await _worker(client, "aviso_lejos@staffya.com", at=TUCUMAN)
    cerca_id = await _subscribe_to_push(client, cerca, "cerca")
    await _subscribe_to_push(client, lejos, "lejos")
    fake_sender = FakePushSender()
    monkeypatch.setattr(
        "app.modules.notification.infrastructure.repositories._get_push_sender",
        lambda: fake_sender,
    )

    employer = await _employer(
        client, "aviso_bar@staffya.com", city="Bahía Blanca", at=BAHIA_BLANCA
    )
    await _publish(client, employer, at=BAHIA_BLANCA, city="Bahía Blanca")

    assert await _avisos(client, cerca) == ["new_shift_nearby"]
    assert await _avisos(client, lejos) == []
    assert await drain_pending_pushes() == 0
    assert [str(push.user_id) for push in fake_sender.sent] == [cerca_id]


async def test_la_escalada_llega_hasta_40_km_y_no_mas_lejos(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    """A 30 km no llega el primer aviso (25 km) y sí el de la escalada
    (40 km); a más de 1.000 km no llega ninguno de los dos."""
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    a_30_km = await _worker(client, "escalada_30@staffya.com", at=_north_of(BAHIA_BLANCA, 30))
    lejos = await _worker(client, "escalada_lejos@staffya.com", at=TUCUMAN)

    employer = await _employer(
        client, "escalada_bar@staffya.com", city="Bahía Blanca", at=BAHIA_BLANCA
    )
    shift_id = await _publish(client, employer, at=BAHIA_BLANCA, city="Bahía Blanca")
    assert await _avisos(client, a_30_km) == []
    assert await _avisos(client, lejos) == []

    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.published_at = datetime.now(timezone.utc) - ESCALATION_DELAY - timedelta(minutes=1)
        await session.commit()
    await scheduler.run_escalation_check()

    assert await _avisos(client, a_30_km) == ["urgent_shift_nearby"]
    assert await _avisos(client, lejos) == []


async def test_recomendados_no_sugieren_a_quien_esta_fuera_del_radio(client: AsyncClient):
    cerca = await _worker(client, "recom_cerca@staffya.com", at=_north_of(BAHIA_BLANCA, 2))
    await _worker(client, "recom_lejos@staffya.com", at=TUCUMAN)

    employer = await _employer(
        client, "recom_bar@staffya.com", city="Bahía Blanca", at=BAHIA_BLANCA
    )
    shift_id = await _publish(client, employer, at=BAHIA_BLANCA, city="Bahía Blanca")

    candidates = await client.get(f"/api/v1/shifts/{shift_id}/candidates", headers=employer)
    assert candidates.status_code == 200
    me = await client.get("/api/v1/workers/me/profile", headers=cerca)
    assert [c["profile_id"] for c in candidates.json()] == [me.json()["id"]]


async def test_sin_ubicacion_se_avisa_solo_si_la_ciudad_coincide(client: AsyncClient):
    """Trabajador sin coordenadas: cuenta si su ciudad es la del turno (sin
    mayúsculas ni tildes). Sin ciudad, o con otra, no se le avisa."""
    misma = await _worker(client, "ciudad_misma@staffya.com", city="bahia blanca")
    otra = await _worker(client, "ciudad_otra@staffya.com", city="San Miguel de Tucumán")
    ninguna = await _worker(client, "ciudad_ninguna@staffya.com")

    employer = await _employer(
        client, "ciudad_bar@staffya.com", city="Bahía Blanca", at=BAHIA_BLANCA
    )
    await _publish(client, employer, at=BAHIA_BLANCA, city="Bahía Blanca")

    assert await _avisos(client, misma) == ["new_shift_nearby"]
    assert await _avisos(client, otra) == []
    assert await _avisos(client, ninguna) == []


async def test_turno_sin_coordenadas_avisa_por_ciudad_tambien_a_quien_tiene_ubicacion(
    client: AsyncClient,
):
    """Un turno sin coordenadas no se puede medir contra nadie: se compara
    por ciudad para todos, tengan o no ubicación."""
    de_la_ciudad = await _worker(
        client, "sincoords_misma@staffya.com", at=BAHIA_BLANCA, city="Bahía Blanca"
    )
    de_otra = await _worker(
        client, "sincoords_otra@staffya.com", at=TUCUMAN, city="San Miguel de Tucumán"
    )

    employer = await _employer(client, "sincoords_bar@staffya.com", city="Bahía Blanca", at=None)
    await _publish(client, employer, at=None, city="Bahía Blanca")

    assert await _avisos(client, de_la_ciudad) == ["new_shift_nearby"]
    assert await _avisos(client, de_otra) == []


async def test_un_favorito_fuera_del_radio_tampoco_recibe_cerca_tuyo(client: AsyncClient):
    """Los favoritos entran siempre al aviso, pero el aviso dice «cerca
    tuyo»: a un favorito de otra provincia no se le manda."""
    favorito = await _worker(client, "fav_lejos@staffya.com", at=TUCUMAN)
    employer = await _employer(
        client, "fav_lejos_bar@staffya.com", city="Bahía Blanca", at=BAHIA_BLANCA
    )
    me = await client.get("/api/v1/workers/me/profile", headers=favorito)
    marked = await client.put(f"/api/v1/favorites/{me.json()['id']}", headers=employer)
    assert marked.status_code in (200, 201, 204), marked.text

    await _publish(client, employer, at=BAHIA_BLANCA, city="Bahía Blanca")

    assert await _avisos(client, favorito) == []


# --- Turno publicado sin zona: se mide desde el local del comercio ----------
#
# La API acepta un turno sin coordenadas y sin ciudad. Con el radio como
# límite duro, ese turno no tenía contra qué medirse: dejaba de avisarle a
# todo el mundo y desaparecía del Inicio y del Mapa, sin que el comercio se
# enterara. Un turno sin zona es, salvo que diga otra cosa, en el local.


async def test_turno_sin_zona_avisa_a_quien_esta_cerca_del_local(client: AsyncClient):
    cerca = await _worker(client, "sinzona_cerca@staffya.com", at=_north_of(PALERMO, 3))
    lejos = await _worker(client, "sinzona_lejos@staffya.com", at=CORDOBA)

    employer = await _employer(client, "sinzona_bar@staffya.com", city="Palermo", at=PALERMO)
    await _publish(client, employer, at=None, city=None)

    assert await _avisos(client, cerca) == ["new_shift_nearby"]
    assert await _avisos(client, lejos) == []


async def test_turno_sin_zona_aparece_en_el_feed_de_quien_esta_cerca_del_local(
    client: AsyncClient,
):
    cerca = await _worker(client, "sinzona_feed_cerca@staffya.com", at=_north_of(PALERMO, 3))
    lejos = await _worker(client, "sinzona_feed_lejos@staffya.com", at=CORDOBA)

    employer = await _employer(
        client, "sinzona_feed_bar@staffya.com", city="Palermo", at=PALERMO
    )
    shift_id = await _publish(client, employer, at=None, city=None)

    assert [s["id"] for s in await _feed(client, cerca)] == [shift_id]
    assert await _feed(client, lejos) == []
    # Buscar sigue mostrando todo, y el turno no se inventa una zona: lo que
    # se usa para medir es el local, pero el turno sigue sin ubicación propia.
    en_buscar = await _feed(client, lejos, scope="all")
    assert [s["id"] for s in en_buscar] == [shift_id]
    assert en_buscar[0]["latitude"] is None
    assert en_buscar[0]["city"] is None


async def test_turno_sin_zona_se_ordena_por_la_distancia_al_local(client: AsyncClient):
    """Entre dos turnos comunes, el del local más cercano va primero aunque
    no tenga zona propia (y aunque sea el más viejo)."""
    worker = await _worker(client, "sinzona_orden@staffya.com", at=PALERMO)
    al_lado = await _employer(
        client, "sinzona_orden_a@staffya.com", city="Palermo", at=_north_of(PALERMO, 1)
    )
    mas_alla = await _employer(
        client, "sinzona_orden_b@staffya.com", city="Palermo", at=_north_of(PALERMO, 20)
    )
    sin_zona = await _publish(client, al_lado, at=None, city=None)
    con_zona = await _publish(client, mas_alla, at=_north_of(PALERMO, 20), city="Palermo")

    assert [s["id"] for s in await _feed(client, worker)] == [sin_zona, con_zona]


async def test_turno_sin_zona_de_un_local_con_ciudad_y_sin_coordenadas_va_por_ciudad(
    client: AsyncClient,
):
    de_la_ciudad = await _worker(client, "sinzona_ciudad_si@staffya.com", city="palermo")
    de_otra = await _worker(client, "sinzona_ciudad_no@staffya.com", city="Córdoba")

    employer = await _employer(client, "sinzona_ciudad_bar@staffya.com", city="Palermo", at=None)
    shift_id = await _publish(client, employer, at=None, city=None)

    assert await _avisos(client, de_la_ciudad) == ["new_shift_nearby"]
    assert await _avisos(client, de_otra) == []
    assert [s["id"] for s in await _feed(client, de_la_ciudad)] == [shift_id]
    assert await _feed(client, de_otra) == []


async def test_turno_sin_zona_tambien_llega_en_la_escalada(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(scheduler, "AsyncSessionLocal", session_factory)
    a_30_km = await _worker(client, "sinzona_esc_30@staffya.com", at=_north_of(PALERMO, 30))
    employer = await _employer(
        client, "sinzona_esc_bar@staffya.com", city="Palermo", at=PALERMO
    )
    shift_id = await _publish(client, employer, at=None, city=None)
    assert await _avisos(client, a_30_km) == []  # el primer aviso llega a 25 km

    async with session_factory() as session:
        model = await session.get(ShiftModel, UUID(shift_id))
        model.published_at = datetime.now(timezone.utc) - ESCALATION_DELAY - timedelta(minutes=1)
        await session.commit()
    await scheduler.run_escalation_check()

    assert await _avisos(client, a_30_km) == ["urgent_shift_nearby"]


async def test_recomendados_de_un_turno_sin_zona_se_miden_desde_el_local(client: AsyncClient):
    cerca = await _worker(client, "sinzona_recom_cerca@staffya.com", at=_north_of(PALERMO, 2))
    await _worker(client, "sinzona_recom_lejos@staffya.com", at=CORDOBA)

    employer = await _employer(
        client, "sinzona_recom_bar@staffya.com", city="Palermo", at=PALERMO
    )
    shift_id = await _publish(client, employer, at=None, city=None)

    candidates = await client.get(f"/api/v1/shifts/{shift_id}/candidates", headers=employer)
    assert candidates.status_code == 200
    me = await client.get("/api/v1/workers/me/profile", headers=cerca)
    assert [c["profile_id"] for c in candidates.json()] == [me.json()["id"]]


async def test_turno_con_ciudad_no_se_mide_desde_el_local(client: AsyncClient):
    """El respaldo es sólo para el turno que no dice NADA de dónde es. Uno
    que dice su ciudad se compara por ciudad, aunque el local quede en otra
    parte (un evento fuera del local)."""
    cerca_del_local = await _worker(client, "evento_afuera@staffya.com", at=PALERMO)

    employer = await _employer(
        client, "evento_afuera_bar@staffya.com", city="Palermo", at=PALERMO
    )
    shift_id = await _publish(client, employer, at=None, city="Córdoba")

    assert await _avisos(client, cerca_del_local) == []
    assert shift_id not in [s["id"] for s in await _feed(client, cerca_del_local)]


async def test_turno_sin_zona_de_un_comercio_sin_ubicacion_no_se_puede_ubicar(
    client: AsyncClient,
):
    """Sin zona en el turno ni en el local no hay contra qué medir: no se
    avisa a nadie y no entra en «cerca» de quien tiene zona. Queda en Buscar.
    (Queda abierto: el comercio todavía no se entera; ver el historial.)"""
    worker = await _worker(client, "sinnada@staffya.com", at=PALERMO, city="Palermo")
    headers = await auth_headers(client, "employer", "sinnada_bar@staffya.com")
    await client.post(
        "/api/v1/companies/me/profile", headers=headers, json={"name": "Bar sin zona"}
    )
    shift_id = await _publish(client, headers, at=None, city=None)

    assert await _avisos(client, worker) == []
    assert await _feed(client, worker) == []
    assert [s["id"] for s in await _feed(client, worker, scope="all")] == [shift_id]


# --- «Disponible ahora» no cambia desde dónde se arma el feed ---------------


async def test_disponible_ahora_mueve_el_aviso_pero_no_el_feed(client: AsyncClient):
    """Comportamiento elegido (y anotado en «Queda abierto»): con «Disponible
    ahora» prendido, el AVISO mide desde esa posición (ADR-0014: es para que
    los comercios te encuentren ahí) y el FEED sigue midiendo desde la zona
    del perfil. Usar esa posición para armar el feed es una decisión de
    producto y de privacidad que no se toma acá."""
    worker = await _worker(
        client, "disp_feed@staffya.com", at=TUCUMAN, city="San Miguel de Tucumán"
    )
    on = await client.post(
        "/api/v1/workers/me/available-now",
        headers=worker,
        json={"latitude": BAHIA_BLANCA[0], "longitude": BAHIA_BLANCA[1]},
    )
    assert on.status_code == 200, on.text

    bahia = await _employer(
        client, "disp_feed_bahia@staffya.com", city="Bahía Blanca", at=BAHIA_BLANCA
    )
    tucuman = await _employer(
        client, "disp_feed_tucuman@staffya.com", city="San Miguel de Tucumán", at=TUCUMAN
    )
    en_bahia = await _publish(client, bahia, at=BAHIA_BLANCA, city="Bahía Blanca")
    en_tucuman = await _publish(
        client, tucuman, at=TUCUMAN, city="San Miguel de Tucumán"
    )

    # El aviso sale por el turno que queda cerca de donde está ahora...
    assert await _avisos(client, worker) == ["new_shift_nearby"]
    # ...y el Inicio le muestra los de la zona de su perfil.
    assert [s["id"] for s in await _feed(client, worker)] == [en_tucuman]
    # El turno del aviso se abre igual: el aviso lleva a /turno/<id>, y Buscar
    # lo trae.
    assert en_bahia in [s["id"] for s in await _feed(client, worker, scope="all")]
    detalle = await client.get(f"/api/v1/shifts/{en_bahia}", headers=worker)
    assert detalle.status_code == 200
