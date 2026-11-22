"""Tests del módulo lead (comercios a captar, panel de admin)."""

import asyncio
import time
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.lead.domain.entities import Lead, PlaceCandidate, PlaceSnapshot
from app.modules.lead.domain.exceptions import PlaceSourceUnavailableError
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.domain.snapshots import SNAPSHOT_MAX_AGE, next_refresh
from app.modules.lead.domain.value_objects import BARRIOS_CABA, LeadKind, LeadStatus
from app.modules.lead.infrastructure import place_snapshot_job
from app.modules.lead.infrastructure.overpass_place_source import (
    OverpassPlaceSource,
    build_query,
    parse_elements,
)
from app.modules.lead.infrastructure.repositories import SqlAlchemyPlaceSnapshotRepository
from tests.conftest import auth_headers, make_admin

pytestmark = pytest.mark.asyncio


def _candidate(ref: str, name: str, kind: LeadKind = LeadKind.RESTAURANTE, **extra) -> PlaceCandidate:
    return PlaceCandidate(
        osm_ref=ref,
        name=name,
        kind=kind,
        barrio="Palermo",
        latitude=-34.58,
        longitude=-58.43,
        **extra,
    )


class FakePlaceSource(PlaceSource):
    def __init__(self, places: list[PlaceCandidate] | None = None, fail: bool = False):
        self.places = places or []
        self.fail = fail
        self.calls: list[str] = []

    async def find_gastronomy(self, barrio: str) -> list[PlaceCandidate]:
        self.calls.append(barrio)
        if self.fail:
            raise PlaceSourceUnavailableError("caído")
        return self.places


_PALERMO = [
    _candidate("node/1", "Café Tranquilo", LeadKind.CAFE),
    _candidate(
        "node/2",
        "Bodegón Don Pepe",
        phone="+54 11 5555-0000",
        instagram="https://instagram.com/donpepe",
        address="Honduras 4800",
    ),
    _candidate("way/3", "Heladería Sur", LeadKind.HELADERIA),
]
_FETCHED = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _job_state():
    """El estado del refresco vive en memoria del proceso: limpio por test."""
    place_snapshot_job.reset()
    yield
    place_snapshot_job.reset()


async def _seed(
    session_factory: async_sessionmaker[AsyncSession],
    barrio: str = "Palermo",
    places: list[PlaceCandidate] | None = None,
    fetched_at: datetime = _FETCHED,
) -> None:
    async with session_factory() as session:
        await SqlAlchemyPlaceSnapshotRepository(session).replace(
            PlaceSnapshot(
                barrio=barrio,
                fetched_at=fetched_at,
                places=tuple(_PALERMO if places is None else places),
            )
        )


async def _make_admin(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    email: str,
) -> dict:
    return await make_admin(client, session_factory, email)


# --- dominio ---------------------------------------------------------------


def test_priority_weighs_kind_and_contact_channels():
    plain_cafe = Lead.from_candidate(_candidate("node/1", "A", LeadKind.CAFE))
    full_restaurant = Lead.from_candidate(
        _candidate("node/2", "B", phone="1", website="https://b.com")
    )
    assert plain_cafe.priority == 2
    assert full_restaurant.priority == 5


def test_follow_up_sets_contacted_at_once_and_not_for_discarded():
    lead = Lead.from_candidate(_candidate("node/1", "A"))
    assert lead.with_follow_up(status=LeadStatus.DESCARTADO).contacted_at is None

    contacted = lead.with_follow_up(status=LeadStatus.CONTACTADO)
    assert contacted.contacted_at is not None
    later = contacted.with_follow_up(status=LeadStatus.INTERESADO)
    assert later.contacted_at == contacted.contacted_at


def test_refresh_keeps_follow_up():
    lead = Lead.from_candidate(_candidate("node/1", "Viejo")).with_follow_up(
        status=LeadStatus.VISITADO, notes="volver el martes"
    )
    fresh = lead.refreshed_from(_candidate("node/1", "Nuevo nombre", phone="123"))
    assert fresh.name == "Nuevo nombre"
    assert fresh.phone == "123"
    assert fresh.status == LeadStatus.VISITADO
    assert fresh.notes == "volver el martes"


# --- adaptador de OpenStreetMap (sin red) ----------------------------------


def test_build_query_targets_barrio_inside_caba():
    query = build_query('Pal"ermo')
    assert '"name"="Palermo"' in query
    assert "Ciudad Autónoma de Buenos Aires" in query
    assert '"admin_level"="10"' in query
    assert "restaurant" in query and "ice_cream" in query


def test_parse_elements_reads_nodes_and_ways_and_skips_incomplete():
    payload = {
        "elements": [
            {
                "type": "node",
                "id": 10,
                "lat": -34.58,
                "lon": -58.42,
                "tags": {
                    "amenity": "pub",
                    "name": "La Cueva",
                    "addr:street": "Thames",
                    "addr:housenumber": "1500",
                    "contact:phone": "+54 11 4000-0000",
                    "contact:instagram": "lacueva",
                },
            },
            {
                "type": "way",
                "id": 20,
                "center": {"lat": -34.59, "lon": -58.43},
                "tags": {"amenity": "restaurant", "name": "El Patio", "website": "https://p.com"},
            },
            {"type": "node", "id": 30, "lat": 1, "lon": 1, "tags": {"amenity": "bar"}},
            {"type": "node", "id": 40, "lat": 1, "lon": 1, "tags": {"amenity": "bank", "name": "X"}},
            {"type": "way", "id": 50, "tags": {"amenity": "cafe", "name": "Sin centro"}},
        ]
    }
    parsed = parse_elements(payload, "Palermo")
    assert [p.osm_ref for p in parsed] == ["node/10", "way/20"]
    pub = parsed[0]
    assert pub.kind == LeadKind.BAR
    assert pub.address == "Thames 1500"
    assert pub.phone == "+54 11 4000-0000"
    assert pub.instagram == "lacueva"
    assert parsed[1].latitude == -34.59


def test_parse_elements_trims_long_values_to_column_size():
    many_phones = ";".join(["+54 11 4000-0000"] * 10)
    payload = {
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": -34.58,
                "lon": -58.42,
                "tags": {"amenity": "cafe", "name": "N" * 300, "phone": many_phones},
            }
        ]
    }
    [place] = parse_elements(payload, "Palermo")
    assert len(place.name) == 200
    assert len(place.phone) == 60


# --- API -------------------------------------------------------------------


async def test_import_list_and_summary(client, session_factory):
    admin = await _make_admin(client, session_factory, "lead_admin1@staffya.com")
    await _seed(session_factory)

    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    assert res.status_code == 200
    body = res.json()
    assert {k: body[k] for k in ("barrio", "found", "created", "updated")} == {
        "barrio": "Palermo",
        "found": 3,
        "created": 3,
        "updated": 0,
    }
    assert datetime.fromisoformat(body["fetched_at"]).replace(tzinfo=timezone.utc) == _FETCHED

    listed = await client.get("/api/v1/admin/leads?barrio=Palermo", headers=admin)
    assert listed.status_code == 200
    names = [lead["name"] for lead in listed.json()]
    # Más prioridad primero: restaurante con teléfono e Instagram (5), café (2), heladería (1).
    assert names == ["Bodegón Don Pepe", "Café Tranquilo", "Heladería Sur"]
    assert listed.json()[0]["priority"] == 5

    summary = await client.get("/api/v1/admin/leads/summary", headers=admin)
    assert summary.json()["total"] == 3
    assert summary.json()["counts"]["nuevo"] == 3
    assert summary.json()["counts"]["alta"] == 0
    assert list(summary.json()["snapshots"]) == ["Palermo"]


async def test_reimport_keeps_status_and_notes(client, session_factory):
    admin = await _make_admin(client, session_factory, "lead_admin2@staffya.com")
    await _seed(session_factory)
    await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    first = (await client.get("/api/v1/admin/leads", headers=admin)).json()[0]

    patched = await client.patch(
        f"/api/v1/admin/leads/{first['id']}",
        json={"status": "interesado", "notes": "Habló con la encargada"},
        headers=admin,
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "interesado"
    assert patched.json()["contacted_at"] is not None

    # La copia se refrescó y el bodegón cambió de nombre.
    await _seed(
        session_factory,
        places=[_candidate("node/2", "Bodegón Don Pepe (renovado)")],
        fetched_at=_FETCHED + timedelta(days=7),
    )
    again = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    assert again.json()["created"] == 0
    assert again.json()["updated"] == 1

    interested = (
        await client.get("/api/v1/admin/leads?status=interesado", headers=admin)
    ).json()
    assert len(interested) == 1
    assert interested[0]["name"] == "Bodegón Don Pepe (renovado)"
    assert interested[0]["notes"] == "Habló con la encargada"


async def test_import_rejects_unknown_barrio(client, session_factory):
    admin = await _make_admin(client, session_factory, "lead_admin3@staffya.com")
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Springfield"}, headers=admin)
    assert res.status_code == 422
    assert place_snapshot_job._requested == []


async def test_import_without_snapshot_queues_the_barrio_first(client, session_factory):
    admin = await _make_admin(client, session_factory, "lead_admin4@staffya.com")
    woken: list[bool] = []
    place_snapshot_job.enable(lambda: woken.append(True))

    await client.post("/api/v1/admin/leads/import", json={"barrio": "Boedo"}, headers=admin)
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    assert res.status_code == 409
    assert res.json()["detail"] == {
        "code": "snapshot_pending",
        "message": "Todavía no tenemos la copia de este barrio; se baja en los próximos minutos.",
    }
    # El último pedido va primero en la cola, y se despierta al scheduler.
    assert place_snapshot_job._requested == ["Palermo", "Boedo"]
    assert woken == [True, True]
    assert (await client.get("/api/v1/admin/leads", headers=admin)).json() == []


async def test_import_from_an_empty_snapshot_is_ok(client, session_factory):
    admin = await _make_admin(client, session_factory, "lead_admin6@staffya.com")
    await _seed(session_factory, barrio="Villa Real", places=[])
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Villa Real"}, headers=admin)
    assert res.status_code == 200
    assert res.json()["found"] == 0


async def test_patch_unknown_lead_is_404(client, session_factory):
    admin = await _make_admin(client, session_factory, "lead_admin5@staffya.com")
    res = await client.patch(
        "/api/v1/admin/leads/00000000-0000-0000-0000-000000000000",
        json={"status": "alta"},
        headers=admin,
    )
    assert res.status_code == 404


async def test_non_admin_cannot_use_leads(client):
    employer = await auth_headers(client, "employer", "lead_emp@staffya.com")
    assert (await client.get("/api/v1/admin/leads", headers=employer)).status_code == 403
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=employer)
    assert res.status_code == 403
    assert place_snapshot_job._requested == []


# --- cuándo refrescar la copia (regla pura) ----------------------------------

_NOW = datetime(2026, 11, 22, 15, 0, tzinfo=timezone.utc)


def test_next_refresh_requested_first_then_missing_then_oldest():
    barrios = ("Almagro", "Boedo", "Caballito")
    fresh = _NOW - timedelta(days=1)
    # Sin copias: el pedido va antes que el orden de la lista.
    assert next_refresh({}, _NOW, requested=["Caballito"], barrios=barrios) == ("Caballito", None)
    assert next_refresh({}, _NOW, barrios=barrios) == ("Almagro", None)
    # Un barrio sin copia va antes que uno con copia vieja.
    old = {"Almagro": _NOW - timedelta(days=9), "Caballito": fresh}
    assert next_refresh(old, _NOW, barrios=barrios) == ("Boedo", None)
    # Todos con copia: la más vieja vencida primero.
    stale = {
        "Almagro": _NOW - timedelta(days=8),
        "Boedo": _NOW - timedelta(days=10),
        "Caballito": fresh,
    }
    assert next_refresh(stale, _NOW, barrios=barrios) == ("Boedo", None)


def test_next_refresh_all_fresh_returns_when_the_oldest_expires():
    barrios = ("Almagro", "Boedo")
    fetched = {"Almagro": _NOW - timedelta(days=2), "Boedo": _NOW - timedelta(days=5)}
    assert next_refresh(fetched, _NOW, barrios=barrios) == (
        None,
        fetched["Boedo"] + SNAPSHOT_MAX_AGE,
    )
    # Un pedido de un barrio que ya tiene copia al día no fuerza nada.
    assert next_refresh(fetched, _NOW, requested=["Almagro"], barrios=barrios)[0] is None


def test_next_refresh_skips_a_barrio_resting_after_a_failure():
    barrios = ("Almagro", "Boedo")
    rest = {"Almagro": _NOW + timedelta(minutes=40)}
    fetched = {"Boedo": _NOW - timedelta(days=1)}
    assert next_refresh(fetched, _NOW, resting_until=rest, barrios=barrios) == (
        None,
        rest["Almagro"],
    )
    assert next_refresh({}, _NOW, resting_until=rest, barrios=barrios) == ("Boedo", None)


# --- refresco de la copia (chequeo del scheduler, sin red) ---------------------


def test_main_le_pasa_el_refresco_de_la_copia_al_scheduler():
    import inspect

    from app import main

    source = inspect.getsource(main.lifespan)
    checks = source.split("extra_checks=(", 1)[1].split(")", 1)[0]
    assert "place_snapshot_job.run_place_snapshot_refresh" in checks
    assert "place_snapshot_job.enable(notify_scheduler)" in source


async def _fresh_everywhere_but(session_factory, missing: str | None, fetched_at: datetime) -> None:
    for barrio in BARRIOS_CABA:
        if barrio != missing:
            await _seed(session_factory, barrio=barrio, places=[], fetched_at=fetched_at)


async def test_refresh_check_downloads_the_missing_barrio_in_a_task(session_factory):
    source = FakePlaceSource(_PALERMO)
    woken: list[bool] = []
    place_snapshot_job.enable(lambda: woken.append(True))
    now = datetime.now(timezone.utc)
    await _fresh_everywhere_but(session_factory, "Palermo", now - timedelta(days=1))

    result = await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, now, pause_s=0
    )
    # La consulta corre aparte: el chequeo vuelve enseguida, sin deadline
    # (lo despierta la tarea al terminar).
    assert result is None
    await place_snapshot_job.wait_until_idle()
    assert source.calls == ["Palermo"]
    assert woken == [True]
    async with session_factory() as session:
        snapshot = await SqlAlchemyPlaceSnapshotRepository(session).get("Palermo")
    assert snapshot is not None
    assert [p.osm_ref for p in snapshot.places] == ["node/1", "node/2", "way/3"]

    # Todo al día: devuelve cuándo vence la copia más vieja (naive UTC) y no
    # arranca otra consulta.
    next_at = await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, now, pause_s=0
    )
    assert next_at == (now - timedelta(days=1) + SNAPSHOT_MAX_AGE).replace(tzinfo=None)
    assert source.calls == ["Palermo"]


async def test_refresh_failure_keeps_the_previous_copy_and_rests(session_factory):
    old = datetime.now(timezone.utc) - timedelta(days=8)
    await _fresh_everywhere_but(session_factory, None, datetime.now(timezone.utc))
    await _seed(session_factory, barrio="Palermo", fetched_at=old)
    source = FakePlaceSource(fail=True)

    assert await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, pause_s=0
    ) is None
    await place_snapshot_job.wait_until_idle()
    assert source.calls == ["Palermo"]
    async with session_factory() as session:
        snapshot = await SqlAlchemyPlaceSnapshotRepository(session).get("Palermo")
    assert snapshot is not None and len(snapshot.places) == 3
    assert snapshot.fetched_at == old

    # En pausa: la próxima pasada no le vuelve a pegar a Overpass enseguida.
    next_at = await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, pause_s=0
    )
    assert next_at is not None
    assert next_at > datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=50)
    assert source.calls == ["Palermo"]


async def test_after_a_failure_the_refresh_pauses_but_not_for_a_request(session_factory):
    source = FakePlaceSource(fail=True)
    await place_snapshot_job.run_place_snapshot_refresh(session_factory, source, pause_s=0)
    await place_snapshot_job.wait_until_idle()
    assert source.calls == [BARRIOS_CABA[0]]

    # Quedan 47 barrios sin copia, pero tras una falla se frena todo un rato.
    next_at = await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, pause_s=0
    )
    assert next_at is not None
    assert next_at > datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=25)
    assert source.calls == [BARRIOS_CABA[0]]

    # Un barrio pedido desde la pantalla no espera esa pausa.
    source.fail = False
    place_snapshot_job.request_refresh("Palermo")
    assert await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, pause_s=0
    ) is None
    await place_snapshot_job.wait_until_idle()
    assert source.calls == [BARRIOS_CABA[0], "Palermo"]


async def test_refresh_empty_answer_does_not_wipe_a_full_copy(session_factory):
    old = datetime.now(timezone.utc) - timedelta(days=8)
    await _fresh_everywhere_but(session_factory, None, datetime.now(timezone.utc))
    await _seed(session_factory, barrio="Palermo", fetched_at=old)

    await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, FakePlaceSource([]), pause_s=0
    )
    await place_snapshot_job.wait_until_idle()
    async with session_factory() as session:
        snapshot = await SqlAlchemyPlaceSnapshotRepository(session).get("Palermo")
    assert snapshot is not None and len(snapshot.places) == 3


async def test_refresh_replaces_the_copy_when_the_query_works(session_factory):
    old = datetime.now(timezone.utc) - timedelta(days=8)
    await _fresh_everywhere_but(session_factory, None, datetime.now(timezone.utc))
    await _seed(session_factory, barrio="Palermo", fetched_at=old)
    renovado = [_candidate("node/9", "Pizzería Nueva"), _candidate("node/9", "Pizzería Nueva")]

    await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, FakePlaceSource(renovado), pause_s=0
    )
    await place_snapshot_job.wait_until_idle()
    async with session_factory() as session:
        snapshot = await SqlAlchemyPlaceSnapshotRepository(session).get("Palermo")
    assert snapshot is not None
    assert [p.name for p in snapshot.places] == ["Pizzería Nueva"]
    assert snapshot.fetched_at > old


async def test_refresh_check_never_runs_two_at_once(session_factory):
    release = asyncio.Event()

    class SlowSource(FakePlaceSource):
        async def find_gastronomy(self, barrio):
            self.calls.append(barrio)
            await release.wait()
            return []

    source = SlowSource()
    assert await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, pause_s=0
    ) is None
    await asyncio.sleep(0)
    assert place_snapshot_job.is_refreshing()
    # Mientras la primera tarea espera a Overpass, el chequeo no arranca otra.
    assert await place_snapshot_job.run_place_snapshot_refresh(
        session_factory, source, pause_s=0
    ) is None
    assert source.calls == [BARRIOS_CABA[0]]
    release.set()
    await place_snapshot_job.wait_until_idle()


async def test_requested_barrio_is_refreshed_first(session_factory):
    source = FakePlaceSource(_PALERMO)
    place_snapshot_job.request_refresh("Villa Urquiza")
    await place_snapshot_job.run_place_snapshot_refresh(session_factory, source, pause_s=0)
    await place_snapshot_job.wait_until_idle()
    assert source.calls == ["Villa Urquiza"]
    assert place_snapshot_job._requested == []


# --- respaldo entre servidores de Overpass (sin red) ------------------------

_ONE_CAFE = {
    "elements": [
        {
            "type": "node",
            "id": 7,
            "lat": -34.58,
            "lon": -58.42,
            "tags": {"amenity": "cafe", "name": "Café Respaldo"},
        }
    ]
}


def _source(
    handler, request_timeout_s: float = 5.0, retry_waits_s: tuple[float, ...] = (0.0, 0.0)
) -> tuple[OverpassPlaceSource, list[str]]:
    hosts: list[str] = []

    async def record(request: httpx.Request) -> httpx.Response:
        hosts.append(request.url.host)
        result = handler(request)
        if asyncio.iscoroutine(result):
            result = await result
        return result

    urls = ("https://uno.test/api", "https://dos.test/api", "https://tres.test/api")
    source = OverpassPlaceSource(
        urls=urls,
        transport=httpx.MockTransport(record),
        request_timeout_s=request_timeout_s,
        retry_waits_s=retry_waits_s,
    )
    return source, hosts


async def test_overpass_tries_servers_one_by_one_until_one_answers():
    def handler(request):
        if request.url.host == "uno.test":
            raise httpx.ConnectError("All connection attempts failed", request=request)
        if request.url.host == "dos.test":
            return httpx.Response(504)
        return httpx.Response(200, json=_ONE_CAFE)

    source, hosts = _source(handler)
    places = await source.find_gastronomy("Palermo")
    assert [p.name for p in places] == ["Café Respaldo"]
    # En serie y en orden: no se le pega a todos a la vez.
    assert hosts == ["uno.test", "dos.test", "tres.test"]


async def test_overpass_stops_at_the_first_server_that_answers():
    source, hosts = _source(lambda request: httpx.Response(200, json=_ONE_CAFE))
    await source.find_gastronomy("Palermo")
    assert hosts == ["uno.test"]


async def test_overpass_retries_rounds_with_a_wait_before_giving_up():
    def handler(request):
        raise httpx.ConnectError("All connection attempts failed", request=request)

    source, hosts = _source(handler, retry_waits_s=(0.05, 0.05))
    start = time.monotonic()
    with pytest.raises(PlaceSourceUnavailableError):
        await source.find_gastronomy("Palermo")
    # Tres vueltas por los tres servidores, con las esperas en el medio.
    assert len(hosts) == 9
    assert time.monotonic() - start >= 0.1


async def test_overpass_second_round_can_succeed():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] <= 3:
            return httpx.Response(429)
        return httpx.Response(200, json=_ONE_CAFE)

    source, hosts = _source(handler)
    places = await source.find_gastronomy("Palermo")
    assert [p.name for p in places] == ["Café Respaldo"]
    assert hosts == ["uno.test", "dos.test", "tres.test", "uno.test"]


async def test_overpass_discards_a_bad_request_and_invalid_json():
    def handler(request):
        if request.url.host == "uno.test":
            return httpx.Response(400, text="consulta inválida")
        return httpx.Response(200, text="no es json")

    source, hosts = _source(handler, retry_waits_s=())
    with pytest.raises(PlaceSourceUnavailableError):
        await source.find_gastronomy("Palermo")
    assert len(hosts) == 3


async def test_overpass_slow_server_is_cut_at_the_request_timeout():
    async def handler(request):
        if request.url.host == "uno.test":
            await asyncio.sleep(30)
        return httpx.Response(200, json=_ONE_CAFE)

    source, hosts = _source(handler, request_timeout_s=0.3)
    start = time.monotonic()
    places = await source.find_gastronomy("Palermo")
    assert [p.name for p in places] == ["Café Respaldo"]
    assert hosts == ["uno.test", "dos.test"]
    assert time.monotonic() - start < 3


async def test_overpass_runtime_error_remark_is_not_a_valid_answer():
    def handler(request):
        if request.url.host == "uno.test":
            return httpx.Response(
                200,
                json={"remark": 'runtime error: Query timed out in "query" at line 1', "elements": []},
            )
        return httpx.Response(200, json=_ONE_CAFE)

    source, hosts = _source(handler)
    places = await source.find_gastronomy("Palermo")
    assert [p.name for p in places] == ["Café Respaldo"]
    assert hosts == ["uno.test", "dos.test"]


async def test_overpass_remark_with_elements_is_accepted():
    payload = {**_ONE_CAFE, "remark": "runtime error: algo parcial"}
    source, _ = _source(lambda request: httpx.Response(200, json=payload))
    places = await source.find_gastronomy("Palermo")
    assert [p.name for p in places] == ["Café Respaldo"]


async def test_overpass_discards_a_json_list_response():
    source, hosts = _source(lambda request: httpx.Response(200, json=[1, 2]), retry_waits_s=())
    with pytest.raises(PlaceSourceUnavailableError):
        await source.find_gastronomy("Palermo")
    assert len(hosts) == 3


def test_build_query_gives_the_server_a_long_timeout():
    assert "[timeout:170]" in build_query("Palermo")
