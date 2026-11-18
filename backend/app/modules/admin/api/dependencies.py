"""Dependencias de FastAPI para el módulo de administración."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.ws_manager import ws_manager
from app.modules.admin.application.ports import AccountDeviceRemover, LiveConnectionCloser
from app.modules.admin.application.services import AdminService
from app.modules.application.infrastructure.repositories import (
    SqlAlchemyShiftApplicationRepository,
)
from app.modules.company.infrastructure.repositories import SqlAlchemyCompanyProfileRepository
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyRefreshSessionRepository,
    SqlAlchemyUserRepository,
)
from app.modules.notification.application.services import PushService
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyPushSubscriptionRepository,
)
from app.modules.shift.api.dependencies import get_shift_service
from app.modules.shift.application.services import ShiftService
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.subscription.api.dependencies import get_billing_gateway
from app.modules.subscription.domain.billing_gateway import BillingGateway
from app.modules.subscription.infrastructure.repositories import (
    SqlAlchemySubscriptionRepository,
)
from app.modules.support.infrastructure.repositories import SqlAlchemySupportTicketRepository
from app.modules.worker.infrastructure.repositories import SqlAlchemyWorkerProfileRepository


class _WsConnectionCloser(LiveConnectionCloser):
    """Adaptador del puerto sobre el administrador de WebSockets."""

    async def close_for_user(self, user_id: UUID) -> int:
        return await ws_manager.close_user_connections(user_id)


class _PushDeviceRemover(AccountDeviceRemover):
    """Adaptador del puerto sobre el caso de uso de dispositivos push."""

    def __init__(self, push: PushService) -> None:
        self._push = push

    async def remove_for_user(self, user_id: UUID) -> int:
        return await self._push.remove_all_for_user(user_id)


def get_admin_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    billing: Annotated[BillingGateway, Depends(get_billing_gateway)],
    # Misma sesión que el resto: FastAPI resuelve `get_session` una sola vez
    # por pedido.
    shift_service: Annotated[ShiftService, Depends(get_shift_service)],
) -> AdminService:
    return AdminService(
        SqlAlchemyUserRepository(session),
        SqlAlchemyShiftRepository(session),
        SqlAlchemyWorkerProfileRepository(session),
        SqlAlchemyCompanyProfileRepository(session),
        SqlAlchemyShiftApplicationRepository(session),
        SqlAlchemySubscriptionRepository(session),
        billing,
        SqlAlchemyRefreshSessionRepository(session),
        SqlAlchemySupportTicketRepository(session),
        # Puerto `AccountSuspensionEffects` (ADR-0024): lo implementa el caso
        # de uso de turnos.
        suspension_effects=shift_service,
        connection_closer=_WsConnectionCloser(),
        device_remover=_PushDeviceRemover(
            PushService(SqlAlchemyPushSubscriptionRepository(session))
        ),
    )
