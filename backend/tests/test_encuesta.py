"""Tests de la encuesta para locales: dominio, POST público, admin, resumen y
retención a los 12 meses."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.rate_limit import reset_all_rate_limiters
from app.modules.encuesta.domain.entities import SurveyResponse, summarize
from app.modules.encuesta.domain.exceptions import InvalidSurveyError
from app.modules.encuesta.domain.value_objects import (
    EventualRange,
    LocalKind,
    PricingPreference,
    RespondentRole,
    Role,
    TeamModel,
)
from app.modules.encuesta.infrastructure.models import SurveyResponseModel
from app.modules.encuesta.infrastructure.retention_job import run_survey_retention
from tests.conftest import auth_headers, make_admin

pytestmark = pytest.mark.asyncio

URL = "/api/v1/encuesta"


def _payload(**extra) -> dict:
    body = {
        "respondent_role": "dueno",
        "business_name": "Lo de Ana",
        "barrio": "Palermo",
        "local_kind": "bar",
        "team_model": "mixto",
        "eventuals_normal_month": "1-3",
        "eventuals_peak_month": "4-10",
        "roles": ["mozo", "barra"],
        "current_channels": ["whatsapp"],
        "pay_per_shift_ars": 40000,
        "last_absence_outcome": ["doble_turno"],
        "pricing_preference": "por_turno",
    }
    body.update(extra)
    return body


def _domain(**extra) -> SurveyResponse:
    args = dict(
        respondent_role=RespondentRole.DUENO,
        business_name="Lo de Ana",
        barrio="Palermo",
        local_kind=LocalKind.BAR,
        team_model=TeamModel.MIXTO,
        eventuals_normal_month=EventualRange.DE_1_A_3,
        eventuals_peak_month=EventualRange.DE_4_A_10,
        pricing_preference=PricingPreference.POR_TURNO,
    )
    args.update(extra)
    return SurveyResponse.create(**args)


async def _count(session_factory: async_sessionmaker[AsyncSession]) -> int:
    async with session_factory() as s:
        return await s.scalar(select(func.count()).select_from(SurveyResponseModel))


# --- dominio ---------------------------------------------------------------


def test_minimal_response_is_valid_and_dedups_lists():
    r = _domain(roles=[Role.MOZO, Role.MOZO, Role.BARRA])
    assert r.roles == (Role.MOZO, Role.BARRA)
    assert not r.has_contact and r.consent_at is None


@pytest.mark.parametrize("pay", [10, 4_999, 1_000_001])
def test_pay_out_of_range_is_rejected(pay):
    with pytest.raises(InvalidSurveyError, match="pago por jornada"):
        _domain(pay_per_shift_ars=pay)


def test_contact_without_consent_is_rejected():
    with pytest.raises(InvalidSurveyError, match="consentimiento"):
        _domain(email="a@b.com")
    with pytest.raises(InvalidSurveyError, match="consentimiento"):
        _domain(contact_name="Ana")


def test_business_name_and_barrio_are_required():
    with pytest.raises(InvalidSurveyError, match="nombre del local"):
        _domain(business_name="  ")
    with pytest.raises(InvalidSurveyError, match="barrio"):
        _domain(barrio="")
    with pytest.raises(InvalidSurveyError, match="demasiado largo"):
        _domain(business_name="x" * 161)
    # El nombre del local no es un dato de contacto: no pide consentimiento.
    ok = _domain()
    assert not ok.has_contact and ok.consent_at is None


def test_beta_needs_phone_or_email():
    with pytest.raises(InvalidSurveyError, match="teléfono o un email"):
        _domain(wants_beta=True, contact_name="Ana", consent=True)
    ok = _domain(wants_beta=True, phone="11 5555-0000", consent=True)
    assert ok.consent_at is not None


def test_bad_phone_and_email_are_rejected():
    with pytest.raises(InvalidSurveyError, match="teléfono"):
        _domain(phone="123", consent=True)
    with pytest.raises(InvalidSurveyError, match="email"):
        _domain(email="no-es-un-mail", consent=True)


def test_summary_median_and_none_without_sample():
    assert summarize([]).pay_per_shift_median_ars is None
    rows = [_domain(pay_per_shift_ars=p) for p in (30000, 50000, 40000)] + [_domain()]
    s = summarize(rows)
    assert s.total == 4 and s.pay_per_shift_median_ars == 40000 and s.pay_per_shift_samples == 3


def test_summary_only_counts_owners_and_managers_for_distributions():
    rows = [
        _domain(respondent_role=RespondentRole.DUENO, pay_per_shift_ars=40000),
        _domain(respondent_role=RespondentRole.ENCARGADO, pay_per_shift_ars=60000),
        _domain(respondent_role=RespondentRole.TRABAJO_EN_EL_LOCAL, pay_per_shift_ars=5000),
        _domain(respondent_role=RespondentRole.OTRO, roles=[Role.COCINA]),
    ]
    s = summarize(rows)
    assert (s.total, s.deciders) == (4, 2)
    assert s.pay_per_shift_median_ars == 50000 and s.pay_per_shift_samples == 2
    assert sum(s.team_model.values()) == 2 and s.roles["cocina"] == 0


# --- POST público ----------------------------------------------------------


async def test_public_post_saves_without_session(client, session_factory):
    res = await client.post(URL, json=_payload())
    assert res.status_code == 201 and res.json() == {"received": True}
    assert await _count(session_factory) == 1


async def test_post_with_contact_and_consent(client, session_factory):
    res = await client.post(
        URL,
        json=_payload(
            wants_beta=True, contact_name="Ana",
            phone="+54 11 5555-0000", consent=True, source="grupo-palermo",
        ),
    )
    assert res.status_code == 201
    async with session_factory() as s:
        row = (await s.execute(select(SurveyResponseModel))).scalar_one()
    assert row.consent_at is not None and row.source == "grupo-palermo"
    assert row.roles == ["mozo", "barra"]


async def test_contact_without_consent_is_422(client, session_factory):
    res = await client.post(URL, json=_payload(email="ana@lo.com"))
    assert res.status_code == 422 and "consentimiento" in res.json()["detail"]
    assert await _count(session_factory) == 0


async def test_missing_required_fields_is_422(client):
    for field in ("respondent_role", "business_name", "barrio"):
        body = _payload()
        del body[field]
        assert (await client.post(URL, json=body)).status_code == 422


async def test_beta_without_contact_is_422(client):
    res = await client.post(URL, json=_payload(wants_beta=True))
    assert res.status_code == 422


@pytest.mark.parametrize(
    "extra",
    [{"local_kind": "boliche"}, {"respondent_role": "cliente"}, {"business_name": ""},
     {"barrio": "  "}, {"business_name": "x" * 161}, {"eventuals_normal_month": "5"}, {"roles": ["ninja"]},
     {"pay_per_shift_ars": 3}, {"pay_per_shift_ars": "mucho"}],
)
async def test_invalid_values_are_422(client, extra):
    assert (await client.post(URL, json=_payload(**extra))).status_code == 422


async def test_honeypot_is_dropped_silently(client, session_factory):
    res = await client.post(URL, json=_payload(company_website="http://spam.com"))
    assert res.status_code == 201 and res.json() == {"received": True}
    assert await _count(session_factory) == 0


async def test_idempotency_key_does_not_duplicate(client, session_factory):
    headers = {"Idempotency-Key": "intento-123"}
    first = await client.post(URL, json=_payload(), headers=headers)
    retry = await client.post(URL, json=_payload(), headers=headers)
    assert first.status_code == retry.status_code == 201
    assert await _count(session_factory) == 1
    await client.post(URL, json=_payload(), headers={"Idempotency-Key": "intento-124"})
    assert await _count(session_factory) == 2


async def test_rate_limit_per_ip(client):
    settings.rate_limit_enabled = True
    reset_all_rate_limiters()
    try:
        codes = [(await client.post(URL, json=_payload())).status_code for _ in range(21)]
    finally:
        settings.rate_limit_enabled = False
        reset_all_rate_limiters()
    assert codes[:20] == [201] * 20 and codes[20] == 429


# --- admin -----------------------------------------------------------------


async def test_admin_endpoints_only_for_admin(client, session_factory):
    await client.post(URL, json=_payload())
    assert (await client.get("/api/v1/admin/encuesta")).status_code in (401, 403)
    assert (await client.get("/api/v1/admin/encuesta/summary")).status_code in (401, 403)
    employer = await auth_headers(client, "employer", "local@x.com")
    worker = await auth_headers(client, "worker", "mozo@x.com")
    for headers in (employer, worker):
        for path in ("/api/v1/admin/encuesta", "/api/v1/admin/encuesta/summary"):
            assert (await client.get(path, headers=headers)).status_code == 403


async def test_admin_list_newest_first_paginated_and_filter(client, session_factory):
    admin = await make_admin(client, session_factory, "admin@x.com")
    await client.post(URL, json=_payload(barrio="Uno"))
    await client.post(
        URL, json=_payload(barrio="Dos", phone="11 5555-0000", consent=True, wants_beta=True)
    )
    res = await client.get("/api/v1/admin/encuesta", headers=admin)
    body = res.json()
    assert body["total"] == 2 and [i["barrio"] for i in body["items"]] == ["Dos", "Uno"]
    assert "client_key" not in body["items"][0]
    assert body["items"][0]["respondent_role"] == "dueno" and body["items"][0]["business_name"]
    page = (await client.get("/api/v1/admin/encuesta?limit=1&offset=1", headers=admin)).json()
    assert [i["barrio"] for i in page["items"]] == ["Uno"] and page["total"] == 2
    con = (await client.get("/api/v1/admin/encuesta?with_contact=true", headers=admin)).json()
    assert con["total"] == 1 and con["items"][0]["phone"] == "11 5555-0000"


async def test_admin_summary(client, session_factory):
    admin = await make_admin(client, session_factory, "admin@x.com")
    empty = (await client.get("/api/v1/admin/encuesta/summary", headers=admin)).json()
    assert empty["total"] == 0 and empty["pay_per_shift_median_ars"] is None
    await client.post(URL, json=_payload(pay_per_shift_ars=30000))
    # Quien no decide cuenta en el total pero no en las distribuciones.
    await client.post(
        URL,
        json=_payload(respondent_role="otro", pay_per_shift_ars=900000, roles=["cocina"],
                      team_model="por_turno"),
    )
    await client.post(
        URL,
        json=_payload(respondent_role="encargado", pay_per_shift_ars=50000, team_model="equipo_fijo", roles=["mozo"],
                      email="a@b.com", consent=True, wants_beta=True),
    )
    await client.post(URL, json=_payload(pay_per_shift_ars=None, pricing_preference="mensualidad"))
    s = (await client.get("/api/v1/admin/encuesta/summary", headers=admin)).json()
    assert s["total"] == 4 and s["deciders"] == 3 and s["with_contact"] == 1
    assert s["team_model"] == {"equipo_fijo": 1, "por_turno": 0, "mixto": 2}
    assert s["eventuals_normal_month"]["1-3"] == 3
    assert s["roles"]["mozo"] == 3 and s["roles"]["barra"] == 2 and s["roles"]["cocina"] == 0
    assert s["pricing_preference"] == {"mensualidad": 1, "por_turno": 2, "no_se": 0}
    assert s["pay_per_shift_median_ars"] == 40000 and s["pay_per_shift_samples"] == 2


# --- retención -------------------------------------------------------------


async def test_purge_after_12_months_keeps_statistics(client, session_factory):
    now = datetime(2027, 12, 1, tzinfo=timezone.utc)
    contact = dict(
        contact_name="Ana", phone="11 5555-0000",
        email="a@b.com", consent=True, wants_beta=True,
    )
    old = _domain(now=now - timedelta(days=366), **contact)
    recent = _domain(now=now - timedelta(days=100), **contact)
    from app.modules.encuesta.infrastructure.repositories import SqlAlchemySurveyRepository

    async with session_factory() as s:
        repo = SqlAlchemySurveyRepository(s)
        await repo.add(old)
        await repo.add(recent)
    await run_survey_retention(session_factory, now, force=True)
    async with session_factory() as s:
        rows = {r.id: r for r in (await s.execute(select(SurveyResponseModel))).scalars()}
    purged = rows[old.id]
    assert (purged.contact_name, purged.phone, purged.email) == (None,) * 3
    assert purged.business_name == "Lo de Ana" and purged.barrio == "Palermo"
    assert purged.team_model == "mixto"
    assert purged.pricing_preference == "por_turno" and purged.local_kind == "bar"
    kept = rows[recent.id]
    assert kept.phone == "11 5555-0000" and kept.email == "a@b.com"


async def test_purge_is_idempotent_and_reports_count(session_factory):
    from app.modules.encuesta.application.services import SurveyService
    from app.modules.encuesta.infrastructure.repositories import SqlAlchemySurveyRepository

    now = datetime(2027, 12, 1, tzinfo=timezone.utc)
    async with session_factory() as s:
        repo = SqlAlchemySurveyRepository(s)
        await repo.add(_domain(now=now - timedelta(days=400), email="a@b.com", consent=True))
        await repo.add(_domain(now=now - timedelta(days=400)))
        service = SurveyService(repo)
        assert await service.purge_expired_contacts(now) == 1
        assert await service.purge_expired_contacts(now) == 0
