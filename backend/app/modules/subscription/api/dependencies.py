"""Dependencias de FastAPI del módulo subscription."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_session
from app.modules.company.api.dependencies import get_company_service
from app.modules.company.application.services import CompanyProfileService
from app.modules.company.domain.exceptions import CompanyProfileNotFoundError
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.domain.email_sender import EmailSender
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.subscription.application.services import SubscriptionService
from app.modules.subscription.domain.billing_gateway import BillingGateway
from app.modules.subscription.infrastructure.mercadopago_adapter import (
    MercadoPagoCheckoutAdapter,
)
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionPaymentRepository,
    SqlAlchemySubscriptionRepository,
)


def get_billing_gateway() -> BillingGateway:
    return MercadoPagoCheckoutAdapter(app_settings)


def get_subscription_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    billing: Annotated[BillingGateway, Depends(get_billing_gateway)],
    email_sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> SubscriptionService:
    return SubscriptionService(
        subscriptions=SqlAlchemySubscriptionRepository(session),
        billing=billing,
        payments=SqlAlchemySubscriptionPaymentRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        users=SqlAlchemyUserRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
        email_sender=email_sender,
    )


async def get_my_company_id(
    current_user: Annotated[User, Depends(require_roles(UserRole.EMPLOYER))],
    company_service: Annotated[CompanyProfileService, Depends(get_company_service)],
) -> UUID:
    """Resuelve el id del perfil de comercio del empleador autenticado.

    404 si todavía no creó su perfil: no hay suscripción que ver/gestionar sin
    comercio dueño (mismo criterio de no-disclosure/recurso propio que
    `company/api/routes.py::get_my_profile`)."""
    try:
        profile = await company_service.get_my_profile(current_user.id)
    except CompanyProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Todavía no creaste tu perfil de comercio",
        ) from exc
    return profile.id
