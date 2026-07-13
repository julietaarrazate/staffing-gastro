"""Tests del módulo subscription (Fase 1 ADR-0005: mensualidad al comercio).

Cubre: gating de capacidad por plan al publicar un turno (gratis tope 3,
básico más, pro ilimitado), `subscribe` con el feature-flag de cobro apagado
y encendido (`FakeBillingGateway`), config de planes y auth (401/404/403).
"""

from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.main import app
from app.modules.subscription.api.dependencies import get_billing_gateway
from app.modules.subscription.infrastructure.fake_billing_gateway import (
    FakeBillingGateway,
)
from tests.conftest import auth_headers

pytestmark = pytest.mark.asyncio


async def _employer_with_company(client: AsyncClient, email: str) -> dict:
    """Empleador con perfil de comercio (arranca en el plan `gratis`)."""
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


def _shift_payload(**overrides) -> dict:
    payload = {
        "position": "mozo",
        "quantity": 1,
        "start_at": "2026-06-28T20:00:00",
        "end_at": "2026-06-29T03:00:00",
        "pay_amount": "70000.00",
        "city": "Palermo",
    }
    payload.update(overrides)
    return payload


async def _publish_new_shift(client: AsyncClient, headers: dict, city: str):
    """Crea y publica un turno; devuelve la respuesta del POST publish (para
    inspeccionar status_code/body sin asumir éxito)."""
    created = await client.post(
        "/api/v1/shifts", headers=headers, json=_shift_payload(city=city)
    )
    assert created.status_code == 201
    shift_id = created.json()["id"]
    return await client.post(f"/api/v1/shifts/{shift_id}/publish", headers=headers)


# --- Gating de capacidad por plan --------------------------------------


async def test_free_plan_publishes_up_to_three_and_blocks_fourth(client: AsyncClient):
    headers = await _employer_with_company(client, "sub_free@staffya.com")

    for i in range(3):
        response = await _publish_new_shift(client, headers, f"Free{i}")
        assert response.status_code == 200
        assert response.json()["status"] == "publicado"

    fourth = await _publish_new_shift(client, headers, "Free3")
    assert fourth.status_code == 402
    assert "límite" in fourth.json()["detail"].lower()
    assert "3" in fourth.json()["detail"]

    subscription = await client.get("/api/v1/subscription", headers=headers)
    assert subscription.status_code == 200
    body = subscription.json()
    assert body["plan_code"] == "gratis"
    assert body["turnos_usados_mes"] == 3
    assert body["max_turnos_mes"] == 3


async def test_upgrading_to_basico_allows_more_publications(client: AsyncClient):
    headers = await _employer_with_company(client, "sub_upgrade@staffya.com")

    for i in range(3):
        response = await _publish_new_shift(client, headers, f"Up{i}")
        assert response.status_code == 200

    blocked = await _publish_new_shift(client, headers, "Up3")
    assert blocked.status_code == 402

    upgraded = await client.post(
        "/api/v1/subscription/subscribe", headers=headers, json={"plan_code": "basico"}
    )
    assert upgraded.status_code == 200
    assert upgraded.json()["plan_code"] == "basico"
    assert upgraded.json()["status"] == "activa"
    assert upgraded.json()["checkout_url"] is None

    now_allowed = await _publish_new_shift(client, headers, "Up4")
    assert now_allowed.status_code == 200
    assert now_allowed.json()["status"] == "publicado"

    subscription = await client.get("/api/v1/subscription", headers=headers)
    body = subscription.json()
    assert body["plan_code"] == "basico"
    assert body["max_turnos_mes"] == 15
    # El cambio de plan resetea el contador: sólo 1 turno en el período nuevo.
    assert body["turnos_usados_mes"] == 1


async def test_pro_plan_is_never_blocked(client: AsyncClient):
    headers = await _employer_with_company(client, "sub_pro@staffya.com")
    subscribed = await client.post(
        "/api/v1/subscription/subscribe", headers=headers, json={"plan_code": "pro"}
    )
    assert subscribed.status_code == 200

    for i in range(5):
        response = await _publish_new_shift(client, headers, f"Pro{i}")
        assert response.status_code == 200
        assert response.json()["status"] == "publicado"

    subscription = await client.get("/api/v1/subscription", headers=headers)
    body = subscription.json()
    assert body["max_turnos_mes"] is None
    assert body["turnos_usados_mes"] == 5


# --- Suscripción / plan --------------------------------------------------


async def test_new_company_defaults_to_free_plan(client: AsyncClient):
    headers = await _employer_with_company(client, "sub_default@staffya.com")
    response = await client.get("/api/v1/subscription", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["plan_code"] == "gratis"
    assert body["status"] == "activa"
    assert body["max_turnos_mes"] == 3
    assert body["turnos_usados_mes"] == 0
    assert Decimal(str(body["price_ars"])) == Decimal("0")


async def test_subscribe_with_flag_off_sets_plan_immediately(client: AsyncClient):
    """Sin credenciales de MP configuradas (flag apagado, default de test),
    `subscribe` setea el plan ya mismo: activa, período nuevo, sin checkout."""
    headers = await _employer_with_company(client, "sub_flagoff@staffya.com")
    response = await client.post(
        "/api/v1/subscription/subscribe", headers=headers, json={"plan_code": "basico"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body == {"plan_code": "basico", "status": "activa", "checkout_url": None}

    subscription = await client.get("/api/v1/subscription", headers=headers)
    sub_body = subscription.json()
    assert sub_body["plan_code"] == "basico"
    assert Decimal(str(sub_body["price_ars"])) == Decimal("20000")


async def test_subscribe_with_flag_on_returns_pending_checkout(client: AsyncClient):
    """Con el feature-flag de cobro encendido (`FakeBillingGateway.enabled_
    =True`), `subscribe` no setea el plan todavía: devuelve el checkout
    "pendiente" de MP y espera la confirmación (webhook, fuera de esta fase)."""
    headers = await _employer_with_company(client, "sub_flagon@staffya.com")
    fake_gateway = FakeBillingGateway(enabled_=True)
    app.dependency_overrides[get_billing_gateway] = lambda: fake_gateway
    try:
        response = await client.post(
            "/api/v1/subscription/subscribe",
            headers=headers,
            json={"plan_code": "pro"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["plan_code"] == "pro"
        assert body["status"] == "pendiente"
        assert body["checkout_url"] is not None
        assert len(fake_gateway.created) == 1

        # El plan persistido NO cambió todavía (queda gratis hasta confirmar).
        subscription = await client.get("/api/v1/subscription", headers=headers)
        assert subscription.json()["plan_code"] == "gratis"
    finally:
        app.dependency_overrides.pop(get_billing_gateway, None)


async def test_subscribe_unknown_plan_rejected(client: AsyncClient):
    headers = await _employer_with_company(client, "sub_unknown@staffya.com")
    response = await client.post(
        "/api/v1/subscription/subscribe", headers=headers, json={"plan_code": "platino"}
    )
    assert response.status_code == 400


async def test_get_plans_returns_config(client: AsyncClient):
    headers = await _employer_with_company(client, "sub_plans@staffya.com")
    response = await client.get("/api/v1/subscription/plans", headers=headers)
    assert response.status_code == 200
    plans = response.json()["plans"]
    codes = [p["code"] for p in plans]
    assert codes == ["gratis", "basico", "pro"]  # orden ascendente de precio

    pro = next(p for p in plans if p["code"] == "pro")
    assert pro["max_turnos_mes"] is None
    assert Decimal(str(pro["price_ars"])) == Decimal("45000")
    assert len(pro["features"]) > 0


# --- Auth -----------------------------------------------------------------


async def test_get_subscription_requires_auth(client: AsyncClient):
    response = await client.get("/api/v1/subscription")
    # `HTTPBearer(auto_error=True)` devuelve 403 sin header; con token
    # inválido/vencido el flujo de `get_current_user` sí da 401 (mismo criterio
    # laxo que `tests/test_identity.py::test_me_requires_auth`).
    assert response.status_code in (401, 403)


async def test_get_subscription_404_without_company_profile(client: AsyncClient):
    headers = await auth_headers(client, "employer", "sub_nocompany@staffya.com")
    response = await client.get("/api/v1/subscription", headers=headers)
    assert response.status_code == 404


async def test_worker_cannot_access_subscription(client: AsyncClient):
    headers = await auth_headers(client, "worker", "sub_worker@staffya.com")
    response = await client.get("/api/v1/subscription", headers=headers)
    assert response.status_code == 403
