"""Dependencias de FastAPI para el módulo de identidad.

Cablea las capas: sesión DB -> repositorio (adaptador) -> servicio (caso de uso),
y resuelve el usuario autenticado a partir del token Bearer.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Query, WebSocket, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_session
from app.modules.identity.application.services import IdentityService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    InactiveUserError,
    InvalidTokenError,
    UserNotFoundError,
)
from app.modules.identity.domain.google_verifier import GoogleTokenVerifier
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.google_token_verifier import GoogleTokenInfoVerifier
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyPasswordResetTokenRepository,
    SqlAlchemyRefreshSessionRepository,
    SqlAlchemyUserRepository,
)
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.domain.email_sender import EmailSender

_bearer_scheme = HTTPBearer(auto_error=True)


def get_google_verifier() -> GoogleTokenVerifier:
    return GoogleTokenInfoVerifier(app_settings)


def get_identity_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    email_sender: Annotated[EmailSender, Depends(get_email_sender)],
    google_verifier: Annotated[GoogleTokenVerifier, Depends(get_google_verifier)],
) -> IdentityService:
    users = SqlAlchemyUserRepository(session)
    sessions = SqlAlchemyRefreshSessionRepository(session)
    password_reset_tokens = SqlAlchemyPasswordResetTokenRepository(session)
    return IdentityService(
        users, sessions, password_reset_tokens, email_sender, google_verifier
    )


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
    session: Annotated[AsyncSession, Depends(get_session)],
    token: Annotated[str | None, Query()] = None,
) -> User:
    """Resuelve el usuario autenticado en un handshake WebSocket.

    No hay header Authorization disponible en un WebSocket del navegador,
    así que el access token viaja como query param (`?token=...`).

    Cierra la sesión de DB explícitamente apenas termina de autenticar. Una
    dependencia `Depends(get_session)` en una ruta WebSocket queda "abierta"
    (según FastAPI) durante toda la conexión (acá, potencialmente horas —
    ver el loop de `notifications_stream`), no sólo el handshake. Sin este
    cierre temprano, la conexión de Neon quedaba reservada del pool sin
    usarse hasta que el WS se desconectaba; para entonces el pooler ya la
    había cortado por inactividad, y el cierre normal de la sesión intentaba
    hacer rollback sobre esa conexión muerta (`InterfaceError: cannot call
    Transaction.rollback(): the underlying connection is closed`, visto en
    Sentry). Cerrando acá mismo, la conexión vuelve al pool mientras todavía
    está viva, y el cierre que hace FastAPI al desconectarse el WS encuentra
    una sesión ya cerrada (no-op).
    """
    if token is None:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    try:
        return await service.get_current_user(token)
    except (InvalidTokenError, UserNotFoundError, InactiveUserError) as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION) from exc
    finally:
        await session.close()


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
