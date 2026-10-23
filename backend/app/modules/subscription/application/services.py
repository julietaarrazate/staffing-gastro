"""Casos de uso del módulo subscription (ADR-0005 Fase 1, ADR-0022).

Con el cobro apagado (sin credenciales de Mercado Pago) todo sigue como en
la beta: cambiar de plan es inmediato y nadie paga. Con el cobro prendido,
cada mes es un pago de Checkout Pro que confirma el webhook; recién ahí se
acredita el mes (`Subscription.apply_payment`).
"""

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID

from app.core.config import settings
from app.core.dt import naive as _naive
from app.core.tz import hoy_art, to_art
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.identity.domain.repositories import UserRepository
from app.modules.notification.domain.email_sender import EmailSender
from app.modules.notification.domain.email_templates import render_subscription_email_html
from app.modules.notification.domain.entities import Notification
from app.modules.notification.domain.repositories import NotificationRepository
from app.modules.notification.domain.value_objects import NotificationType
from app.modules.subscription.domain.billing_gateway import APPROVED, BillingGateway
from app.modules.subscription.domain.entities import (
    GRACE_PERIOD,
    REMINDER_LEAD,
    Subscription,
    SubscriptionPayment,
    withdrawal_deadline,
)
from app.modules.subscription.domain.exceptions import (
    BillingDisabledError,
    WithdrawalNotAvailableError,
)
from app.modules.subscription.domain.plans import Plan, get_plan, list_plans
from app.modules.subscription.domain.repositories import (
    SubscriptionPaymentRepository,
    SubscriptionRepository,
)
from app.modules.subscription.domain.value_objects import (
    ExpiryNotice,
    PaymentStatus,
    SubscriptionStatus,
)

logger = logging.getLogger(__name__)

# Estados de Mercado Pago que cierran un intento sin cobro.
_FAILED_STATUSES = frozenset({"rejected", "cancelled"})


@dataclass
class SubscribeResult:
    """Resultado de `POST /subscription/subscribe`. Con el cobro prendido,
    `status` es `pendiente` hasta que el webhook confirme el pago."""

    plan_code: str
    status: str
    checkout_url: str | None


@dataclass
class SubscriptionOverview:
    """Lo que ve el comercio en "Mi plan"."""

    subscription: Subscription
    plan: Plan
    billing_enabled: bool
    can_publish: bool
    withdrawal_until: date | None


@dataclass
class WebhookOutcome:
    """Qué hizo el webhook con una notificación (para logs y tests)."""

    result: str


class SubscriptionService:
    """Servicio de aplicación para gestionar la suscripción del comercio."""

    def __init__(
        self,
        subscriptions: SubscriptionRepository,
        billing: BillingGateway,
        payments: SubscriptionPaymentRepository | None = None,
        companies: CompanyProfileRepository | None = None,
        users: UserRepository | None = None,
        notifications: NotificationRepository | None = None,
        email_sender: EmailSender | None = None,
    ) -> None:
        self._subscriptions = subscriptions
        self._billing = billing
        self._payments = payments
        self._companies = companies
        self._users = users
        self._notifications = notifications
        self._email_sender = email_sender

    # --- Lectura ------------------------------------------------------------

    @property
    def billing_enabled(self) -> bool:
        return self._billing.enabled

    def _enforced(self) -> bool:
        return settings.subscriptions_enforced and self._billing.enabled

    def _initial_status(self) -> SubscriptionStatus:
        return SubscriptionStatus.PENDIENTE if self._enforced() else SubscriptionStatus.ACTIVA

    async def get_my_subscription(self, company_id: UUID) -> Subscription:
        return await self._subscriptions.get_or_create(
            company_id, initial_status=self._initial_status()
        )

    async def get_overview(self, company_id: UUID) -> SubscriptionOverview:
        now = datetime.now(UTC)
        subscription = await self.get_my_subscription(company_id)
        plan = get_plan(subscription.plan_code)
        billing = self._billing.enabled
        can_publish = subscription.is_paid(now) if self._enforced() else True
        withdrawal_until = await self._withdrawal_until(company_id) if billing else None
        return SubscriptionOverview(
            subscription=subscription,
            plan=plan,
            billing_enabled=billing,
            can_publish=can_publish,
            withdrawal_until=withdrawal_until,
        )

    @staticmethod
    def list_plans() -> list[Plan]:
        return list_plans()

    # --- Elegir plan / pagar -------------------------------------------------

    async def subscribe(
        self, company_id: UUID, plan_code: str, *, payer_email: str
    ) -> SubscribeResult:
        """Suscribe al comercio a un plan.

        - Cobro prendido: crea el intento de pago y la preferencia de
          Checkout Pro; devuelve `pendiente` + el link. El mes se acredita
          cuando el webhook confirme el pago.
        - Cobro apagado: setea el plan ya mismo (como en la beta).
        """
        plan = get_plan(plan_code)  # UnknownPlanError si no existe

        if self._billing.enabled:
            assert self._payments is not None
            subscription = await self.get_my_subscription(company_id)
            intent = await self._payments.add(
                SubscriptionPayment(
                    company_id=subscription.company_id,
                    plan_code=plan.code,
                    amount_ars=plan.price_ars,
                )
            )
            checkout = await self._billing.create_checkout(
                intent_id=intent.id, plan=plan, payer_email=payer_email
            )
            intent.mp_preference_id = checkout.preference_id
            await self._payments.update(intent)
            logger.info(
                "subscription.checkout_created",
                extra={
                    "company_id": str(company_id),
                    "plan": plan.code,
                    "intent_id": str(intent.id),
                },
            )
            return SubscribeResult(
                plan_code=plan.code, status="pendiente", checkout_url=checkout.checkout_url
            )

        subscription = await self._subscriptions.get_or_create(company_id)
        subscription.change_plan(plan.code)
        subscription = await self._subscriptions.update(subscription)
        return SubscribeResult(
            plan_code=subscription.plan_code,
            status=subscription.status.value,
            checkout_url=None,
        )

    async def handle_payment_notification(self, mp_payment_id: str) -> WebhookOutcome:
        """Webhook de Mercado Pago (la firma ya se validó en la API).

        Nunca se le cree al cuerpo de la notificación: se lee el pago de la
        API de Mercado Pago y sólo si está `approved` y el monto y la moneda
        coinciden con el intento, se acredita el mes. Idempotente por id de
        pago: el mismo pago notificado dos veces acredita un solo mes.
        """
        assert self._payments is not None
        already = await self._payments.get_by_mp_payment_id(mp_payment_id)
        if already is not None and already.status != PaymentStatus.PENDIENTE:
            return WebhookOutcome("duplicado")

        payment = await self._billing.get_payment(mp_payment_id)
        if payment is None:
            return WebhookOutcome("desconocido")
        try:
            intent_id = UUID(payment.external_reference or "")
        except ValueError:
            return WebhookOutcome("ignorado")
        intent = await self._payments.get_by_id(intent_id)
        if intent is None:
            return WebhookOutcome("ignorado")

        if payment.status != APPROVED:
            if payment.status in _FAILED_STATUSES and intent.status == PaymentStatus.PENDIENTE:
                intent.status = PaymentStatus.RECHAZADO
                await self._payments.update(intent)
                return WebhookOutcome("rechazado")
            return WebhookOutcome("pendiente")

        if intent.status in (PaymentStatus.APROBADO, PaymentStatus.REEMBOLSADO):
            # Mismo link pagado dos veces: no se acredita otro mes solo; queda
            # en el log para devolverlo a mano.
            logger.error(
                "subscription.payment.extra_payment",
                extra={"intent_id": str(intent.id), "mp_payment_id": mp_payment_id},
            )
            return WebhookOutcome("pago_extra")

        if not intent.matches(payment.amount, payment.currency):
            logger.error(
                "subscription.payment.amount_mismatch",
                extra={
                    "intent_id": str(intent.id),
                    "expected": str(intent.amount_ars),
                    "got": str(payment.amount),
                    "currency": payment.currency,
                },
            )
            return WebhookOutcome("monto_no_coincide")

        now = datetime.now(UTC)
        won = await self._payments.try_approve(
            intent.id, mp_payment_id=payment.id, approved_at=payment.approved_at or now
        )
        if not won:
            return WebhookOutcome("duplicado")

        subscription = await self._subscriptions.get_or_create(intent.company_id)
        subscription.apply_payment(intent.plan_code, now)
        subscription = await self._subscriptions.update(subscription)
        logger.info(
            "subscription.payment.approved",
            extra={"company_id": str(intent.company_id), "plan": intent.plan_code},
        )
        plan = get_plan(intent.plan_code)
        until = to_art(subscription.paid_until).strftime("%d/%m") if subscription.paid_until else ""
        await self._notify(
            intent.company_id,
            NotificationType.SUBSCRIPTION_PAID,
            "Recibimos tu pago",
            f"Tu plan {plan.name} está activo hasta el {until}.",
            cta="Ver mi plan",
        )
        return WebhookOutcome("aprobado")

    # --- Baja y arrepentimiento ---------------------------------------------

    async def cancel_renewal(self, company_id: UUID) -> Subscription:
        """Dar de baja: deja de recordarle que pague. El plan sigue hasta el
        final del mes pago (no hay débito que cortar, ADR-0022)."""
        if not self._billing.enabled:
            raise BillingDisabledError()
        subscription = await self.get_my_subscription(company_id)
        subscription.cancel_renewal(datetime.now(UTC))
        return await self._subscriptions.update(subscription)

    async def _withdrawal_until(self, company_id: UUID) -> date | None:
        """Último día para arrepentirse, o `None` si ya no corresponde."""
        assert self._payments is not None
        paid = await self._payments.list_approved_by_company(company_id)
        if not paid or any(p.status == PaymentStatus.REEMBOLSADO for p in paid):
            return None
        first = paid[0]
        if first.approved_at is None:
            return None
        deadline = withdrawal_deadline(first.approved_at)
        return deadline if hoy_art() <= deadline else None

    async def withdraw(self, company_id: UUID) -> Subscription:
        """Arrepentimiento (Ley 24.240, art. 34): dentro de los 10 días
        corridos del primer pago, se devuelve todo lo pagado por Mercado Pago
        y el plan se corta."""
        if not self._billing.enabled:
            raise BillingDisabledError()
        assert self._payments is not None
        if await self._withdrawal_until(company_id) is None:
            raise WithdrawalNotAvailableError()
        now = datetime.now(UTC)
        for payment in await self._payments.list_approved_by_company(company_id):
            if payment.status != PaymentStatus.APROBADO or payment.mp_payment_id is None:
                continue
            # BillingGatewayError corta acá: lo ya reembolsado queda marcado y
            # reintentar no devuelve dos veces (misma idempotency key).
            await self._billing.refund_payment(
                payment.mp_payment_id, idempotency_key=f"oido-refund-{payment.id}"
            )
            payment.status = PaymentStatus.REEMBOLSADO
            payment.refunded_at = now
            await self._payments.update(payment)
        subscription = await self.get_my_subscription(company_id)
        subscription.withdraw(now)
        subscription = await self._subscriptions.update(subscription)
        logger.info("subscription.withdrawn", extra={"company_id": str(company_id)})
        await self._notify(
            company_id,
            NotificationType.SUBSCRIPTION_REFUNDED,
            "Te devolvimos el pago",
            "Cancelamos tu plan y pedimos la devolución a Mercado Pago. "
            "Puede tardar unos días en verse en tu cuenta.",
            cta="Ver mi plan",
        )
        return subscription

    # --- Vencimiento (lo corre el scheduler) ---------------------------------

    async def run_expiry_check(self, now: datetime | None = None) -> datetime | None:
        """Una pasada del chequeo de vencimiento. Devuelve la próxima
        deadline futura (naive UTC, para que el scheduler sepa cuánto dormir).

        - `paid_until - 3 días`: aviso "tu plan vence en 3 días".
        - `paid_until`: aviso "tu plan venció hoy, tenés 3 días de gracia".
        - `paid_until + 3 días`: pasa a `vencida` (o `cancelada` si dio de
          baja) y deja de poder publicar.
        A quien dio de baja no se le recuerda pagar.
        """
        now = now or datetime.now(UTC)
        now_n = _naive(now)
        next_deadline: datetime | None = None

        def earlier(candidate: datetime) -> None:
            nonlocal next_deadline
            if next_deadline is None or candidate < next_deadline:
                next_deadline = candidate

        for subscription in await self._subscriptions.list_paid():
            if subscription.paid_until is None:
                continue
            paid_until = _naive(subscription.paid_until)
            expire_at = paid_until + GRACE_PERIOD
            remind_at = paid_until - REMINDER_LEAD
            plan = get_plan(subscription.plan_code)

            if now_n >= expire_at:
                subscription.expire()
                await self._subscriptions.update(subscription)
                logger.info(
                    "subscription.expired",
                    extra={
                        "company_id": str(subscription.company_id),
                        "status": subscription.status.value,
                    },
                )
                if subscription.renews:
                    await self._notify(
                        subscription.company_id,
                        NotificationType.SUBSCRIPTION_EXPIRED,
                        "Tu plan está vencido",
                        f"No registramos el pago del plan {plan.name}. Pagá el mes para "
                        "volver a publicar turnos.",
                        cta="Pagar el mes",
                    )
                continue

            earlier(expire_at)
            if not subscription.renews:
                continue

            if now_n >= paid_until:
                if subscription.expiry_notice != ExpiryNotice.VENCIO:
                    subscription.expiry_notice = ExpiryNotice.VENCIO
                    await self._subscriptions.update(subscription)
                    await self._notify(
                        subscription.company_id,
                        NotificationType.SUBSCRIPTION_EXPIRING,
                        "Tu plan venció hoy",
                        f"Tenés 3 días para pagar el plan {plan.name} antes de que se "
                        "pause la publicación de turnos.",
                        cta="Pagar el mes",
                    )
            elif now_n >= remind_at:
                if subscription.expiry_notice is None:
                    subscription.expiry_notice = ExpiryNotice.POR_VENCER
                    await self._subscriptions.update(subscription)
                    await self._notify(
                        subscription.company_id,
                        NotificationType.SUBSCRIPTION_EXPIRING,
                        "Tu plan vence en 3 días",
                        f"El plan {plan.name} vence el "
                        f"{to_art(subscription.paid_until).strftime('%d/%m')}. "
                        "Pagá el mes que viene desde Mi plan.",
                        cta="Pagar el mes",
                    )
                earlier(paid_until)
            else:
                earlier(remind_at)
        return next_deadline

    # --- Avisos ---------------------------------------------------------------

    async def _notify(
        self, company_id: UUID, type_: NotificationType, title: str, message: str, *, cta: str
    ) -> None:
        """Aviso in-app + email, best-effort: un fallo acá nunca deshace un
        pago ya acreditado ni un vencimiento ya guardado."""
        if self._companies is None or self._users is None:
            return
        try:
            company = await self._companies.get_by_id(company_id)
            if company is None:
                return
            if self._notifications is not None:
                await self._notifications.add(
                    Notification(
                        user_id=company.user_id,
                        type=type_,
                        title=title,
                        message=message,
                        link="/subscription",
                    )
                )
            if self._email_sender is not None:
                user = await self._users.get_by_id(company.user_id)
                if user is not None:
                    html = render_subscription_email_html(
                        user.full_name,
                        title=title,
                        text=message,
                        cta_label=cta,
                        link=f"{settings.frontend_url}/subscription",
                    )
                    await self._email_sender.send(to=user.email, subject=title, html=html)
        except Exception:
            logger.exception("No se pudo avisar al comercio %s (%s)", company_id, type_.value)
