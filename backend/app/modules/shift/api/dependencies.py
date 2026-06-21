"""Dependencias de FastAPI del módulo shift."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.company.api.dependencies import get_company_service
from app.modules.company.application.services import CompanyProfileService
from app.modules.company.domain.exceptions import CompanyProfileNotFoundError
from app.modules.company.infrastructure.repositories import (
    SqlAlchemyCompanyProfileRepository,
)
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.notification.infrastructure.repositories import (
    SqlAlchemyNotificationRepository,
)
from app.modules.shift.application.services import ShiftService
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository
from app.modules.worker.api.dependencies import get_worker_service
from app.modules.worker.application.services import WorkerProfileService
from app.modules.worker.domain.exceptions import WorkerProfileNotFoundError
from app.modules.worker.infrastructure.repositories import (
    SqlAlchemyWorkerProfileRepository,
)


def get_shift_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ShiftService:
    return ShiftService(
        shifts=SqlAlchemyShiftRepository(session),
        workers=SqlAlchemyWorkerProfileRepository(session),
        companies=SqlAlchemyCompanyProfileRepository(session),
        notifications=SqlAlchemyNotificationRepository(session),
    )


async def get_my_company_id(
    current_user: Annotated[User, Depends(require_roles(UserRole.EMPLOYER))],
    company_service: Annotated[CompanyProfileService, Depends(get_company_service)],
) -> UUID:
    """Resuelve el id del perfil de comercio del empleador autenticado.

    Un comercio debe tener su perfil creado antes de publicar turnos.
    """
    try:
        profile = await company_service.get_my_profile(current_user.id)
    except CompanyProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primero creá tu perfil de comercio para publicar turnos",
        ) from exc
    return profile.id


async def get_my_worker_profile_id(
    current_user: Annotated[User, Depends(require_roles(UserRole.WORKER))],
    worker_service: Annotated[WorkerProfileService, Depends(get_worker_service)],
) -> UUID:
    """Resuelve el id del perfil de trabajador del usuario autenticado."""
    try:
        profile = await worker_service.get_my_profile(current_user.id)
    except WorkerProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primero creá tu perfil de trabajador",
        ) from exc
    return profile.id
