"""Tests del módulo lead (comercios a captar, panel de admin)."""

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.lead.api.dependencies import get_place_source
from app.modules.lead.domain.entities import Lead, PlaceCandidate
from app.modules.lead.domain.exceptions import PlaceSourceUnavailableError
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.domain.value_objects import LeadKind, LeadStatus
from app.modules.lead.infrastructure.overpass_place_source import (
    OverpassPlaceSource,
    build_query,
    parse_elements,
)
from tests.conftest import auth_headers, login

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


@pytest.fixture
def places():
    source = FakePlaceSource(
        [
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
    )
    app.dependency_overrides[get_place_source] = lambda: source
    yield source
    app.dependency_overrides.pop(get_place_source, None)


async def _make_admin(
    client: AsyncClient,
    session_factory: async_sessionmaker[AsyncSession],
    email: str,
) -> dict:
    await auth_headers(client, "employer", email)
    async with session_factory() as session:
        repo = SqlAlchemyUserRepository(session)
        user = await repo.get_by_email(email)
        user.promote_to_admin()
        await repo.update(user)
    tokens = await login(client, email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


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


async def test_import_list_and_summary(client, session_factory, places):
    admin = await _make_admin(client, session_factory, "lead_admin1@staffya.com")

    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    assert res.status_code == 200
    assert res.json() == {"barrio": "Palermo", "found": 3, "created": 3, "updated": 0}
    assert places.calls == ["Palermo"]

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


async def test_reimport_keeps_status_and_notes(client, session_factory, places):
    admin = await _make_admin(client, session_factory, "lead_admin2@staffya.com")
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

    places.places = [_candidate("node/2", "Bodegón Don Pepe (renovado)")]
    again = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    assert again.json()["created"] == 0
    assert again.json()["updated"] == 1

    interested = (
        await client.get("/api/v1/admin/leads?status=interesado", headers=admin)
    ).json()
    assert len(interested) == 1
    assert interested[0]["name"] == "Bodegón Don Pepe (renovado)"
    assert interested[0]["notes"] == "Habló con la encargada"


async def test_import_rejects_unknown_barrio(client, session_factory, places):
    admin = await _make_admin(client, session_factory, "lead_admin3@staffya.com")
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Springfield"}, headers=admin)
    assert res.status_code == 422
    assert places.calls == []


async def test_import_when_source_is_down(client, session_factory, places):
    admin = await _make_admin(client, session_factory, "lead_admin4@staffya.com")
    places.fail = True
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=admin)
    assert res.status_code == 502


async def test_patch_unknown_lead_is_404(client, session_factory, places):
    admin = await _make_admin(client, session_factory, "lead_admin5@staffya.com")
    res = await client.patch(
        "/api/v1/admin/leads/00000000-0000-0000-0000-000000000000",
        json={"status": "alta"},
        headers=admin,
    )
    assert res.status_code == 404


async def test_non_admin_cannot_use_leads(client, places):
    employer = await auth_headers(client, "employer", "lead_emp@staffya.com")
    assert (await client.get("/api/v1/admin/leads", headers=employer)).status_code == 403
    res = await client.post("/api/v1/admin/leads/import", json={"barrio": "Palermo"}, headers=employer)
    assert res.status_code == 403
    assert places.calls == []


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


def _source(handler) -> tuple[OverpassPlaceSource, list[str]]:
    hosts: list[str] = []

    def record(request: httpx.Request) -> httpx.Response:
        hosts.append(request.url.host)
        return handler(request)

    urls = ("https://uno.test/api", "https://dos.test/api", "https://tres.test/api")
    return OverpassPlaceSource(urls=urls, transport=httpx.MockTransport(record)), hosts


async def test_overpass_falls_back_when_a_server_does_not_connect():
    def handler(request):
        if request.url.host == "uno.test":
            raise httpx.ConnectError("All connection attempts failed", request=request)
        if request.url.host == "dos.test":
            return httpx.Response(429)
        return httpx.Response(200, json=_ONE_CAFE)

    source, hosts = _source(handler)
    places = await source.find_gastronomy("Palermo")
    assert [p.name for p in places] == ["Café Respaldo"]
    assert hosts == ["uno.test", "dos.test", "tres.test"]


async def test_overpass_stops_at_the_first_server_that_answers():
    source, hosts = _source(lambda request: httpx.Response(200, json=_ONE_CAFE))
    await source.find_gastronomy("Palermo")
    assert hosts == ["uno.test"]


async def test_overpass_raises_when_every_server_fails():
    def handler(request):
        raise httpx.ConnectError("All connection attempts failed", request=request)

    source, hosts = _source(handler)
    with pytest.raises(PlaceSourceUnavailableError):
        await source.find_gastronomy("Palermo")
    assert len(hosts) == 3


async def test_overpass_does_not_retry_a_bad_request():
    source, hosts = _source(lambda request: httpx.Response(400, text="consulta inválida"))
    with pytest.raises(PlaceSourceUnavailableError):
        await source.find_gastronomy("Palermo")
    assert hosts == ["uno.test"]
