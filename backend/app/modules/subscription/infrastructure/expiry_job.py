"""Pasada del chequeo de vencimiento de planes pagos (ADR-0021), armada con
los adaptadores reales. La llama el scheduler en proceso
(`shift/application/scheduler.py`), igual que los chequeos del turno.

Con el cobro apagado no toca la base: no hay `paid_until` que mirar y cada
consulta de más despierta a Neon (incidente de cuota 2026-08-26).
"""

from datetime import datetime

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.infrastructure.null_email_sender import NullEmailSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.notification.infrastructure.resend_email_sender import ResendEmailSender
from app.modules.subscription.application.services import SubscriptionService
from app.modules.subscription.infrastructure.mercadopago_adapter import (
    MercadoPagoCheckoutAdapter,
)
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionPaymentRepository,
    SqlAlchemySubscriptionRepository,
)


async def run_subscription_expiry_check() -> datetime | None:
    """Devuelve la próxima deadline de vencimiento (naive UTC) o `None`."""
    if not settings.billing_enabled:
        return None
    async with AsyncSessionLocal() as session:
        email_sender = (
            ResendEmailSender(settings) if settings.resend_api_key else NullEmailSender()
        )
        service = SubscriptionService(
            subscriptions=SqlAlchemySubscriptionRepository(session),
            billing=MercadoPagoCheckoutAdapter(settings),
            payments=SqlAlchemySubscriptionPaymentRepository(session),
            companies=SqlAlchemyCompanyProfileRepository(session),
            users=SqlAlchemyUserRepository(session),
            notifications=SqlAlchemyNotificationRepository(session),
            email_sender=email_sender,
        )
        return await service.run_expiry_check()
