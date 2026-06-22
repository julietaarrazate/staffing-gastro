"""Dependencias de FastAPI para el módulo de identidad.

Cablea las capas: sesión DB -> repositorio (adaptador) -> servicio (caso de uso),
y resuelve el usuario autenticado a partir del token Bearer.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Query, WebSocket, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.identity.application.services import IdentityService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    InactiveUserError,
    InvalidTokenError,
    UserNotFoundError,
)
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.repositories import SqlAlchemyUserRepository

_bearer_scheme = HTTPBearer(auto_error=True)


def get_identity_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IdentityService:
    repository = SqlAlchemyUserRepository(session)
    return IdentityService(repository)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
    service: Annotated[IdentityService, Depends(get_identity_service)],
) -> User:
    try:
        return await service.get_current_user(credentials.credentials)
    except (InvalidTokenError, UserNotFoundError, InactiveUserError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user_ws(
    websocket: WebSocket,
    service: Annotated[IdentityService, Depends(get_identity_service)],
    token: Annotated[str | None, Query()] = None,
) -> User:
    """Resuelve el usuario autenticado en un handshake WebSocket.

    No hay header Authorization disponible en un WebSocket del navegador,
    así que el access token viaja como query param (`?token=...`).
    """
    if token is None:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    try:
        return await service.get_current_user(token)
    except (InvalidTokenError, UserNotFoundError, InactiveUserError) as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION) from exc


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Factory de dependencia que exige que el usuario tenga uno de los roles dados."""

    async def _checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return current_user

    return _checker
