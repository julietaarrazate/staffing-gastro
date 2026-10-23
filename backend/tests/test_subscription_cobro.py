"""Cobro mensual con Mercado Pago (ADR-0021), sin red: `FakeBillingGateway`.

Cubre: firma del webhook (válida / inválida), idempotencia por id de pago,
monto que no coincide, extensión de un período activo, gating de publicación
con el cobro exigido, chequeo de vencimiento (avisos y `vencida`), baja,
ventana de arrepentimiento y que con el cobro apagado todo siga como en la
beta.
"""

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.dt import naive
from app.main import app
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.infrastructure.fake_email_sender import FakeEmailSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.subscription.api.dependencies import get_billing_gateway
from app.modules.subscription.application.services import SubscriptionService
from app.modules.subscription.domain.billing_gateway import GatewayPayment
from app.modules.subscription.domain.entities import (
    GRACE_PERIOD,
    PERIOD_LENGTH,
    Subscription,
    SubscriptionPayment,
    withdrawal_deadline,
)
from app.modules.subscription.domain.exceptions import (
    NothingToCancelError,
    SubscriptionNotActiveError,
)
from app.modules.subscription.domain.plans import get_plan
from app.modules.subscription.domain.value_objects import SubscriptionStatus
from app.modules.subscription.infrastructure.fake_billing_gateway import FakeBillingGateway
from app.modules.subscription.infrastructure.mercadopago_adapter import (
    build_preference_payload,
)
from app.modules.subscription.infrastructure.mercadopago_signature import verify_signature
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionPaymentRepository,
    SqlAlchemySubscriptionRepository,
)
from tests.conftest import auth_headers

SECRET = "clave-secreta-de-test"
WEBHOOK = "/api/v1/subscription/webhooks/mercadopago"


def _mp_signature(data_id: str, *, secret: str = SECRET, request_id: str = "req-1",
                  ts: str = "1761200000") -> dict:
    """Firma armada a mano con el formato documentado por Mercado Pago, sin
    usar el código de producción (si el código se equivoca, esto no)."""
    manifest = f"id:{data_id.lower()};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


# --- Unidad: dominio y firma -----------------------------------------------


def _sub(**overrides) -> Subscription:
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    data = dict(
        company_id=UUID(int=1),
        plan_code="inicial",
        status=SubscriptionStatus.PENDIENTE,
        period_start=now,
        period_end=now + PERIOD_LENGTH,
    )
    data.update(overrides)
    return Subscription(**data)


def test_signature_valid_and_invalid():
    headers = _mp_signature("123456")
    assert verify_signature(
        secret=SECRET, x_signature=headers["x-signature"], request_id="req-1", data_id="123456"
    )
    # Otra clave, otro id, otro request-id o sin header: no pasa.
    assert not verify_signature(
        secret="otra", x_signature=headers["x-signature"], request_id="req-1", data_id="123456"
    )
    assert not verify_signature(
        secret=SECRET, x_signature=headers["x-signature"], request_id="req-1", data_id="999"
    )
    assert not verify_signature(
        secret=SECRET, x_signature=headers["x-signature"], request_id="req-2", data_id="123456"
    )
    assert not verify_signature(secret=SECRET, x_signature=None, request_id="r", data_id="1")
    assert not verify_signature(secret=SECRET, x_signature="v1=abc", request_id="r", data_id="1")


def test_signature_lowercases_alphanumeric_id():
    headers = _mp_signature("ABC123")
    assert verify_signature(
        secret=SECRET, x_signature=headers["x-signature"], request_id="req-1", data_id="ABC123"
    )


def test_first_payment_starts_today_and_renewal_extends_from_paid_until():
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    sub = _sub()
    sub.apply_payment("inicial", now)
    assert sub.status == SubscriptionStatus.ACTIVA
    assert sub.paid_until == now + PERIOD_LENGTH

    # Renueva 5 días antes de que venza: no pierde esos 5 días.
    later = now + timedelta(days=25)
    sub.turnos_usados_mes = 3
    sub.apply_payment("inicial", later)
    assert sub.paid_until == now + 2 * PERIOD_LENGTH
    # Mismo plan: la ventana de uso no se reinicia por pagar.
    assert sub.turnos_usados_mes == 3


def test_plan_change_resets_usage_and_keeps_paid_days():
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    sub = _sub()
    sub.apply_payment("inicial", now)
    sub.turnos_usados_mes = 5
    sub.apply_payment("pro", now + timedelta(days=10))
    assert sub.plan_code == "pro"
    assert sub.turnos_usados_mes == 0
    assert sub.paid_until == now + 2 * PERIOD_LENGTH


def test_payment_after_expiry_starts_from_payment_date():
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    sub = _sub(status=SubscriptionStatus.VENCIDA, paid_until=now - timedelta(days=10))
    sub.apply_payment("basico", now)
    assert sub.paid_until == now + PERIOD_LENGTH
    assert sub.status == SubscriptionStatus.ACTIVA


def test_ensure_paid_respects_grace_period():
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    sub = _sub(status=SubscriptionStatus.ACTIVA, paid_until=now)
    sub.ensure_paid(now + GRACE_PERIOD - timedelta(minutes=1))
    with pytest.raises(SubscriptionNotActiveError):
        sub.ensure_paid(now + GRACE_PERIOD)
    with pytest.raises(SubscriptionNotActiveError):
        _sub().ensure_paid(now)  # pendiente, nunca pagó


def test_cancel_renewal_needs_paid_month_and_expire_marks_cancelada():
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    with pytest.raises(NothingToCancelError):
        _sub().cancel_renewal(now)
    sub = _sub()
    sub.apply_payment("inicial", now)
    sub.cancel_renewal(now)
    assert sub.renews is False
    sub.expire()
    assert sub.status == SubscriptionStatus.CANCELADA


def test_withdrawal_deadline_is_ten_calendar_days_in_argentina():
    # 23/10 01:00 UTC = 22/10 22:00 en Argentina → vence el 01/11.
    paid = datetime(2026, 10, 23, 1, 0, tzinfo=UTC)
    assert withdrawal_deadline(paid).isoformat() == "2026-11-01"


def test_amount_must_match():
    intent = SubscriptionPayment(company_id=UUID(int=1), plan_code="inicial",
                                 amount_ars=Decimal("9900"))
    assert intent.matches(Decimal("9900.00"), "ARS")
    assert not intent.matches(Decimal("990"), "ARS")
    assert not intent.matches(Decimal("9900"), "USD")


def test_preference_payload_is_checkout_pro_without_credit_card():
    payload = build_preference_payload(
        settings,
        intent_id=UUID(int=7),
        plan=get_plan("basico"),
        payer_email="bar@oido.com.ar",
    )
    assert payload["items"][0]["unit_price"] == 20000.0
    assert payload["items"][0]["currency_id"] == "ARS"
    assert payload["external_reference"] == str(UUID(int=7))
    assert payload["payment_methods"]["excluded_payment_types"] == [{"id": "credit_card"}]
    assert payload["back_urls"]["success"].endswith("/subscription?pago=ok")
    assert payload["back_urls"]["pending"].endswith("/subscription?pago=pendiente")
    assert payload["back_urls"]["failure"].endswith("/subscription?pago=error")
    assert "oido.com.ar" in payload["back_urls"]["success"]
    assert "staffya" not in str(payload)
    assert payload["notification_url"].endswith("/api/v1/subscription/webhooks/mercadopago")


# --- API con el cobro prendido ---------------------------------------------


@pytest.fixture
def billing_on():
    """Cobro real exigido: credenciales (falsas) + tope prendido + gateway fake."""
    previous = (
        settings.mercadopago_access_token,
        settings.mercadopago_webhook_secret,
        settings.subscriptions_enforced,
    )
    settings.mercadopago_access_token = "TEST-token"
    settings.mercadopago_webhook_secret = SECRET
    settings.subscriptions_enforced = True
    gateway = FakeBillingGateway(enabled_=True)
    app.dependency_overrides[get_billing_gateway] = lambda: gateway
    yield gateway
    app.dependency_overrides.pop(get_billing_gateway, None)
    (
        settings.mercadopago_access_token,
        settings.mercadopago_webhook_secret,
        settings.subscriptions_enforced,
    ) = previous


async def _employer(client: AsyncClient, email: str) -> dict:
    headers = await auth_headers(client, "employer", email)
    await client.post(
        "/api/v1/companies/me/profile",
        headers=headers,
        json={"name": "Bar Palermo", "city": "Palermo"},
    )
    return headers


async def _publish(client: AsyncClient, headers: dict):
    created = await client.post(
        "/api/v1/shifts",
        headers=headers,
        json={
            "position": "mozo",
            "quantity": 1,
            "start_at": "2026-12-28T20:00:00",
            "end_at": "2026-12-29T03:00:00",
            "pay_amount": "70000.00",
            "city": "Palermo",
        },
    )
    assert created.status_code == 201
    return await client.post(f"/api/v1/shifts/{created.json()['id']}/publish", headers=headers)


async def _checkout(client: AsyncClient, headers: dict, gateway: FakeBillingGateway,
                    plan: str = "inicial") -> UUID:
    res = await client.post(
        "/api/v1/subscription/subscribe", headers=headers, json={"plan_code": plan}
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "pendiente"
    assert res.json()["checkout_url"].startswith("https://fake-mp.test/")
    return gateway.created[-1][0]


def _mp_payment(gateway: FakeBillingGateway, intent_id: UUID, payment_id: str, *,
                amount: str = "9900", status: str = "approved", currency: str = "ARS",
                approved_at: datetime | None = None) -> None:
    gateway.payments[payment_id] = GatewayPayment(
        id=payment_id,
        status=status,
        amount=Decimal(amount),
        currency=currency,
        external_reference=str(intent_id),
        approved_at=approved_at or datetime.now(UTC),
    )


async def _notify(client: AsyncClient, payment_id: str, headers: dict | None = None):
    return await client.post(
        f"{WEBHOOK}?data.id={payment_id}&type=payment",
        json={"type": "payment", "action": "payment.updated", "data": {"id": payment_id}},
        headers=headers if headers is not None else _mp_signature(payment_id),
    )


async def test_new_company_is_pending_and_cannot_publish(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_pend@oido.com.ar")
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "pendiente"
    assert sub["billing_enabled"] is True
    assert sub["can_publish"] is False

    blocked = await _publish(client, headers)
    assert blocked.status_code == 402
    assert "no está activo" in blocked.json()["detail"]


async def test_webhook_approved_activates_and_unblocks(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_ok@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "1001")

    res = await _notify(client, "1001")
    assert res.status_code == 200
    assert res.json()["result"] == "aprobado"

    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "activa"
    assert sub["can_publish"] is True
    assert sub["renews"] is True
    assert sub["withdrawal_until"] is not None
    paid_until = datetime.fromisoformat(sub["paid_until"])
    assert abs(naive(paid_until) - naive(datetime.now(UTC) + PERIOD_LENGTH)) < timedelta(minutes=1)

    published = await _publish(client, headers)
    assert published.status_code == 200

    notifications = (await client.get("/api/v1/notifications", headers=headers)).json()
    items = notifications["items"] if isinstance(notifications, dict) else notifications
    assert any(n["type"] == "subscription_paid" for n in items)


async def test_webhook_is_idempotent_by_payment_id(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_idem@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "2001")

    assert (await _notify(client, "2001")).json()["result"] == "aprobado"
    first = (await client.get("/api/v1/subscription", headers=headers)).json()["paid_until"]
    again = await _notify(client, "2001", headers=_mp_signature("2001", request_id="req-2"))
    assert again.status_code == 200
    assert again.json()["result"] == "duplicado"
    second = (await client.get("/api/v1/subscription", headers=headers)).json()["paid_until"]
    assert first == second


async def test_webhook_with_bad_signature_is_rejected(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_firma@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "3001")

    bad = await _notify(client, "3001", headers=_mp_signature("3001", secret="otra-clave"))
    assert bad.status_code == 401
    missing = await _notify(client, "3001", headers={})
    assert missing.status_code == 401
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "pendiente"


async def test_webhook_amount_mismatch_does_not_activate(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_monto@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on, plan="pro")
    _mp_payment(billing_on, intent_id, "4001", amount="9900")  # pidió Pro, $45.000

    res = await _notify(client, "4001")
    assert res.status_code == 200
    assert res.json()["result"] == "monto_no_coincide"
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "pendiente"
    assert sub["plan_code"] == "inicial"


async def test_webhook_not_approved_does_not_activate(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_rech@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "5001", status="rejected")
    assert (await _notify(client, "5001")).json()["result"] == "rechazado"
    _mp_payment(billing_on, intent_id, "5002", status="in_process")
    assert (await _notify(client, "5002")).json()["result"] == "pendiente"
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "pendiente"
    # Reintenta con otra tarjeta/cuenta y sale: se acredita.
    _mp_payment(billing_on, intent_id, "5003")
    assert (await _notify(client, "5003")).json()["result"] == "aprobado"


async def test_other_topics_are_ignored(client: AsyncClient, billing_on):
    res = await client.post(
        f"{WEBHOOK}?data.id=99&type=merchant_order", json={"type": "merchant_order"}
    )
    assert res.status_code == 200
    assert res.json()["result"] == "ignorado"


async def test_renewal_extends_active_period(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_renueva@oido.com.ar")
    first = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, first, "6001")
    await _notify(client, "6001")
    second = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, second, "6002")
    assert (await _notify(client, "6002")).json()["result"] == "aprobado"

    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    paid_until = naive(datetime.fromisoformat(sub["paid_until"]))
    expected = naive(datetime.now(UTC) + 2 * PERIOD_LENGTH)
    assert abs(paid_until - expected) < timedelta(minutes=1)


async def test_cancel_renewal_keeps_plan_until_period_end(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_baja@oido.com.ar")
    nothing = await client.post("/api/v1/subscription/cancel-renewal", headers=headers)
    assert nothing.status_code == 409

    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "7001")
    await _notify(client, "7001")
    res = await client.post("/api/v1/subscription/cancel-renewal", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["renews"] is False
    assert body["status"] == "activa"
    assert body["can_publish"] is True


async def test_withdraw_within_ten_days_refunds_and_cancels(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_arrep@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "8001", approved_at=datetime.now(UTC) - timedelta(days=9))
    await _notify(client, "8001")

    res = await client.post("/api/v1/subscription/withdraw", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "cancelada"
    assert body["can_publish"] is False
    assert body["withdrawal_until"] is None
    assert billing_on.refunds == ["8001"]

    # Una sola vez: no hay un segundo reembolso.
    again = await client.post("/api/v1/subscription/withdraw", headers=headers)
    assert again.status_code == 409
    assert billing_on.refunds == ["8001"]


async def test_withdraw_after_ten_days_is_rejected(client: AsyncClient, billing_on):
    headers = await _employer(client, "cobro_tarde@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "9001", approved_at=datetime.now(UTC) - timedelta(days=12))
    await _notify(client, "9001")

    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["withdrawal_until"] is None
    res = await client.post("/api/v1/subscription/withdraw", headers=headers)
    assert res.status_code == 409
    assert "10 días" in res.json()["detail"]
    assert billing_on.refunds == []


# --- Vencimiento (chequeo del scheduler) -----------------------------------


async def test_expiry_check_reminds_then_expires(client: AsyncClient, billing_on, session_factory):
    headers = await _employer(client, "cobro_vence@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "10001")
    await _notify(client, "10001")
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    paid_until = datetime.fromisoformat(sub["paid_until"])
    if paid_until.tzinfo is None:
        paid_until = paid_until.replace(tzinfo=UTC)

    emails = FakeEmailSender()
    async with session_factory() as session:
        service = SubscriptionService(
            subscriptions=SqlAlchemySubscriptionRepository(session),
            billing=billing_on,
            payments=SqlAlchemySubscriptionPaymentRepository(session),
            companies=SqlAlchemyCompanyProfileRepository(session),
            users=SqlAlchemyUserRepository(session),
            notifications=SqlAlchemyNotificationRepository(session),
            email_sender=emails,
        )
        # Lejos del vencimiento: nada, y la próxima deadline es el aviso.
        nxt = await service.run_expiry_check(paid_until - timedelta(days=10))
        assert emails.sent == []
        assert nxt == naive(paid_until - timedelta(days=3))

        # 3 días antes: un aviso, una sola vez.
        await service.run_expiry_check(paid_until - timedelta(days=2))
        await service.run_expiry_check(paid_until - timedelta(days=1))
        assert [e.subject for e in emails.sent] == ["Tu plan vence en 3 días"]

        # El día que vence: segundo aviso; sigue pudiendo publicar (gracia).
        await service.run_expiry_check(paid_until + timedelta(hours=1))
        assert emails.sent[-1].subject == "Tu plan venció hoy"
        assert len(emails.sent) == 2

        # Pasada la gracia: vencida y avisada.
        await service.run_expiry_check(paid_until + GRACE_PERIOD + timedelta(minutes=1))
        assert emails.sent[-1].subject == "Tu plan está vencido"

    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "vencida"
    assert sub["can_publish"] is False
    assert (await _publish(client, headers)).status_code == 402


async def test_expiry_check_skips_reminders_after_baja(
    client: AsyncClient, billing_on, session_factory
):
    headers = await _employer(client, "cobro_baja_vence@oido.com.ar")
    intent_id = await _checkout(client, headers, billing_on)
    _mp_payment(billing_on, intent_id, "11001")
    await _notify(client, "11001")
    await client.post("/api/v1/subscription/cancel-renewal", headers=headers)
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    paid_until = datetime.fromisoformat(sub["paid_until"])
    if paid_until.tzinfo is None:
        paid_until = paid_until.replace(tzinfo=UTC)

    emails = FakeEmailSender()
    async with session_factory() as session:
        service = SubscriptionService(
            subscriptions=SqlAlchemySubscriptionRepository(session),
            billing=billing_on,
            companies=SqlAlchemyCompanyProfileRepository(session),
            users=SqlAlchemyUserRepository(session),
            notifications=SqlAlchemyNotificationRepository(session),
            email_sender=emails,
        )
        await service.run_expiry_check(paid_until - timedelta(days=2))
        await service.run_expiry_check(paid_until + timedelta(hours=1))
        await service.run_expiry_check(paid_until + GRACE_PERIOD + timedelta(minutes=1))
    assert emails.sent == []
    sub = (await client.get("/api/v1/subscription", headers=headers)).json()
    assert sub["status"] == "cancelada"


# --- Con el cobro apagado, todo como en la beta ----------------------------


async def test_billing_off_keeps_beta_behavior(client: AsyncClient):
    previous = settings.subscriptions_enforced
    settings.subscriptions_enforced = True  # aun con el tope prendido
    try:
        headers = await _employer(client, "cobro_off@oido.com.ar")
        sub = (await client.get("/api/v1/subscription", headers=headers)).json()
        assert sub["status"] == "activa"
        assert sub["billing_enabled"] is False
        assert sub["can_publish"] is True
        assert sub["paid_until"] is None
        assert (await _publish(client, headers)).status_code == 200

        assert (
            await client.post("/api/v1/subscription/cancel-renewal", headers=headers)
        ).status_code == 409
        assert (
            await client.post("/api/v1/subscription/withdraw", headers=headers)
        ).status_code == 409
        webhook = await client.post(f"{WEBHOOK}?data.id=1&type=payment", json={})
        assert webhook.status_code == 404
    finally:
        settings.subscriptions_enforced = previous
