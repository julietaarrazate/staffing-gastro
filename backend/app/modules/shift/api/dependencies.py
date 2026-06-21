"""Dependencias de FastAPI del módulo shift."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.company.api.dependencies import get_company_service
from app.modules.company.application.services import CompanyProfileService
from app.modules.company.domain.exceptions import CompanyProfileNotFoundError
from app.modules.identity.api.dependencies import require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.shift.application.services import ShiftService
from app.modules.shift.infrastructure.repositories import SqlAlchemyShiftRepository


def get_shift_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ShiftService:
    repository = SqlAlchemyShiftRepository(session)
    return ShiftService(repository)


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
