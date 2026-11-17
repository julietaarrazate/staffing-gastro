"""Medición de la beta, M6: plan elegido al darse de alta (servidor),
compromiso de pago registrado por la admin y métricas de suscripción."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.main import app
from app.modules.company.infrastructure.models import CompanyProfileModel
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.subscription.api.dependencies import get_billing_gateway
from app.modules.subscription.domain.entities import Subscription
from app.modules.subscription.domain.exceptions import InvalidPaymentCommitmentError
from app.modules.subscription.domain.value_objects import SubscriptionStatus
from app.modules.subscription.infrastructure.fake_billing_gateway import FakeBillingGateway
from app.modules.subscription.infrastructure.models import SubscriptionModel
from tests.conftest import auth_headers, make_admin

pytestmark = pytest.mark.asyncio

NOW = datetime(2026, 11, 17, 15, 0, tzinfo=UTC)


def _sub() -> Subscription:
    return Subscription(
        company_id=uuid4(),
        plan_code="inicial",
        status=SubscriptionStatus.ACTIVA,
        period_start=NOW,
        period_end=NOW + timedelta(days=30),
    )


# --- Dominio -----------------------------------------------------------


async def test_plan_elegido_la_primera_vez_gana():
    sub = _sub()
    assert sub.register_chosen_plan("basico", NOW) is True
    assert sub.register_chosen_plan("pro", NOW + timedelta(days=1)) is False
    assert sub.chosen_plan_code == "basico"
    assert sub.chosen_plan_at == NOW


async def test_compromiso_valido_y_borrado():
    sub = _sub()
    sub.register_payment_commitment("basico", 15000, NOW)
    assert sub.payment_commitment_plan_code == "basico"
    assert sub.payment_commitment_price_ars == Decimal("15000")
    assert sub.payment_commitment_at == NOW
    sub.clear_payment_commitment()
    assert sub.payment_commitment_at is None
    assert sub.payment_commitment_plan_code is None
    assert sub.payment_commitment_price_ars is None


@pytest.mark.parametrize("price", [0, -5, 1500.5, True])
async def test_compromiso_con_precio_invalido(price):
    with pytest.raises(InvalidPaymentCommitmentError):
        _sub().register_payment_commitment("basico", price, NOW)


# --- Endpoint del comercio ---------------------------------------------


async def _employer(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _user_id(session_factory, email: str) -> str:
    async with session_factory() as session:
        user = await SqlAlchemyUserRepository(session).get_by_email(email)
        return str(user.id)


async def _subs(session_factory) -> list[SubscriptionModel]:
    async with session_factory() as session:
        return list((await session.execute(select(SubscriptionModel))).scalars().all())


async def test_plan_elegido_se_guarda_una_sola_vez(client, session_factory):
    emp = await _employer(client, "emp_elegido@test.com")

    first = await client.post(
        "/api/v1/subscription/plan-elegido", headers=emp, json={"plan_code": "basico"}
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/v1/subscription/plan-elegido", headers=emp, json={"plan_code": "pro"}
    )
    assert second.status_code == 200

    [sub] = await _subs(session_factory)
    assert sub.chosen_plan_code == "basico"
    assert sub.chosen_plan_at is not None
    # No cambia el plan vigente.
    assert sub.plan_code == "inicial"
    mine = await client.get("/api/v1/subscription", headers=emp)
    assert mine.json()["plan_code"] == "inicial"


async def test_plan_elegido_desconocido_es_422(client, session_factory):
    emp = await _employer(client, "emp_elegido422@test.com")
    resp = await client.post(
        "/api/v1/subscription/plan-elegido", headers=emp, json={"plan_code": "platino"}
    )
    assert resp.status_code == 422
    assert all(s.chosen_plan_code is None for s in await _subs(session_factory))


async def test_plan_elegido_pide_sesion_de_comercio(client):
    sin_sesion = await client.post("/api/v1/subscription/plan-elegido", json={"plan_code": "pro"})
    assert sin_sesion.status_code == 401
    worker = await auth_headers(client, "worker", "worker_elegido@test.com")
    resp = await client.post(
        "/api/v1/subscription/plan-elegido", headers=worker, json={"plan_code": "pro"}
    )
    assert resp.status_code in (403, 404)


# --- Endpoints de admin -------------------------------------------------


async def test_admin_registra_y_borra_el_compromiso(client, session_factory):
    admin = await make_admin(client, session_factory, "admin_comp1@test.com")
    emp = await _employer(client, "emp_comp1@test.com")
    emp_id = await _user_id(session_factory, "emp_comp1@test.com")
    await client.post(
        "/api/v1/subscription/plan-elegido", headers=emp, json={"plan_code": "pro"}
    )

    put = await client.put(
        f"/api/v1/admin/users/{emp_id}/payment-commitment",
        headers=admin,
        json={"plan_code": "basico", "price_ars": 15000},
    )
    assert put.status_code == 200
    commitment = put.json()["commitment"]
    assert commitment["plan_code"] == "basico"
    assert commitment["plan_name"] == "Básico"
    assert Decimal(str(commitment["price_ars"])) == Decimal("15000")

    detail = await client.get(f"/api/v1/admin/users/{emp_id}", headers=admin)
    summary = detail.json()["subscription"]
    assert summary["plan_code"] == "inicial"
    assert summary["chosen_plan_code"] == "pro"
    assert summary["chosen_plan_name"] == "Pro"
    assert summary["commitment"]["plan_code"] == "basico"

    # Corregir: se pisa con el nuevo.
    again = await client.put(
        f"/api/v1/admin/users/{emp_id}/payment-commitment",
        headers=admin,
        json={"plan_code": "pro", "price_ars": 30000},
    )
    assert Decimal(str(again.json()["commitment"]["price_ars"])) == Decimal("30000")

    deleted = await client.delete(
        f"/api/v1/admin/users/{emp_id}/payment-commitment", headers=admin
    )
    assert deleted.status_code == 200
    assert deleted.json()["commitment"] is None
    # El plan elegido sigue.
    assert deleted.json()["chosen_plan_code"] == "pro"


async def test_compromiso_valida_plan_y_precio(client, session_factory):
    admin = await make_admin(client, session_factory, "admin_comp2@test.com")
    await _employer(client, "emp_comp2@test.com")
    emp_id = await _user_id(session_factory, "emp_comp2@test.com")
    url = f"/api/v1/admin/users/{emp_id}/payment-commitment"

    assert (
        await client.put(url, headers=admin, json={"plan_code": "platino", "price_ars": 1000})
    ).status_code == 422
    assert (
        await client.put(url, headers=admin, json={"plan_code": "pro", "price_ars": 0})
    ).status_code == 422
    assert (
        await client.put(url, headers=admin, json={"plan_code": "pro", "price_ars": 99.5})
    ).status_code == 422


async def test_compromiso_404_si_no_es_comercio_o_no_existe(client, session_factory):
    admin = await make_admin(client, session_factory, "admin_comp3@test.com")
    await auth_headers(client, "worker", "worker_comp3@test.com")
    worker_id = await _user_id(session_factory, "worker_comp3@test.com")
    body = {"plan_code": "pro", "price_ars": 1000}

    for user_id in (worker_id, "00000000-0000-4000-8000-000000000000"):
        url = f"/api/v1/admin/users/{user_id}/payment-commitment"
        assert (await client.put(url, headers=admin, json=body)).status_code == 404
        assert (await client.delete(url, headers=admin)).status_code == 404


async def test_compromiso_no_admin_403(client, session_factory):
    emp = await _employer(client, "emp_comp4@test.com")
    emp_id = await _user_id(session_factory, "emp_comp4@test.com")
    url = f"/api/v1/admin/users/{emp_id}/payment-commitment"
    assert (
        await client.put(url, headers=emp, json={"plan_code": "pro", "price_ars": 1000})
    ).status_code == 403
    assert (await client.delete(url, headers=emp)).status_code == 403


# --- Métricas ----------------------------------------------------------


async def test_metricas_plan_elegido_y_compromiso_sin_cuentas_de_prueba(client, session_factory):
    admin = await make_admin(client, session_factory, "admin_met1@test.com")
    real = await _employer(client, "emp_met_real@test.com")
    real2 = await _employer(client, "emp_met_real2@test.com")
    prueba = await _employer(client, "prueba.comercio@oido.beta")
    for headers, plan in ((real, "basico"), (real2, "basico"), (prueba, "pro")):
        await client.post(
            "/api/v1/subscription/plan-elegido", headers=headers, json={"plan_code": plan}
        )
    for email, price in (("emp_met_real@test.com", 15000), ("prueba.comercio@oido.beta", 99999)):
        uid = await _user_id(session_factory, email)
        resp = await client.put(
            f"/api/v1/admin/users/{uid}/payment-commitment",
            headers=admin,
            json={"plan_code": "basico", "price_ars": price},
        )
        assert resp.status_code == 200

    body = (await client.get("/api/v1/admin/subscription-stats", headers=admin)).json()
    assert body["companies_with_chosen_plan"] == {"basico": 2}
    assert body["committed_companies"] == 1
    assert Decimal(str(body["committed_mrr_ars"])) == Decimal("15000")


async def test_mrr_con_cobro_apagado_sigue_siendo_potencial(client, session_factory):
    admin = await make_admin(client, session_factory, "admin_met2@test.com")
    emp = await _employer(client, "emp_met_off@test.com")
    await client.post("/api/v1/subscription/subscribe", headers=emp, json={"plan_code": "basico"})

    body = (await client.get("/api/v1/admin/subscription-stats", headers=admin)).json()
    assert body["billing_enabled"] is False
    assert Decimal(str(body["mrr_ars"])) == Decimal("20000")


async def test_mrr_con_cobro_prendido_cuenta_solo_meses_pagos(client, session_factory):
    admin = await make_admin(client, session_factory, "admin_met3@test.com")
    pago = await _employer(client, "emp_met_pago@test.com")
    sin_pagar = await _employer(client, "emp_met_nopago@test.com")
    vencido = await _employer(client, "emp_met_vencido@test.com")
    for headers in (pago, sin_pagar, vencido):
        # Crea la fila de la suscripción (activa sin pagar, como en la beta).
        await client.post(
            "/api/v1/subscription/plan-elegido", headers=headers, json={"plan_code": "pro"}
        )

    now = datetime.now(UTC)
    async with session_factory() as session:
        pago_id = await _user_id(session_factory, "emp_met_pago@test.com")
        vencido_id = await _user_id(session_factory, "emp_met_vencido@test.com")


        for user_id, plan, paid_until in (
            (pago_id, "basico", now + timedelta(days=10)),
            (vencido_id, "pro", now - timedelta(days=1)),
        ):
            company_id = (
                await session.execute(
                    select(CompanyProfileModel.id).where(
                        CompanyProfileModel.user_id == UUID(user_id)
                    )
                )
            ).scalar_one()
            sub = (
                await session.execute(
                    select(SubscriptionModel).where(SubscriptionModel.company_id == company_id)
                )
            ).scalar_one()
            sub.plan_code = plan
            sub.paid_until = paid_until
        await session.commit()

    app.dependency_overrides[get_billing_gateway] = lambda: FakeBillingGateway(enabled_=True)
    try:
        body = (await client.get("/api/v1/admin/subscription-stats", headers=admin)).json()
    finally:
        app.dependency_overrides.pop(get_billing_gateway, None)
    assert body["billing_enabled"] is True
    # Sólo el comercio con el mes vigente: básico $20.000.
    assert Decimal(str(body["mrr_ars"])) == Decimal("20000")
