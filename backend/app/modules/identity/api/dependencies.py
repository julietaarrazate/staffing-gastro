"""Dependencias de FastAPI para el módulo de identidad.

Cablea las capas: sesión DB -> repositorio (adaptador) -> servicio (caso de uso),
y resuelve el usuario autenticado a partir del token Bearer.
"""

import logging
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Query, Request, WebSocket, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_session
from app.core.edge import client_ip
from app.modules.identity.application.dtos import AuthenticatedSession
from app.modules.identity.application.services import GUEST_ACCOUNT_EMAILS, IdentityService
from app.modules.identity.application.two_factor import TwoFactorService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    InactiveUserError,
    InvalidTokenError,
    UserNotFoundError,
)
from app.modules.identity.domain.google_verifier import GoogleTokenVerifier
from app.modules.identity.domain.two_factor import AdminGate
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.fernet_secret_cipher import FernetSecretCipher
from app.modules.identity.infrastructure.google_token_verifier import GoogleTokenInfoVerifier
from app.modules.identity.infrastructure.repositories import (
    SqlAlchemyEmailVerificationTokenRepository,
    SqlAlchemyPasswordResetTokenRepository,
    SqlAlchemyRefreshSessionRepository,
    SqlAlchemyTermsAcceptanceRepository,
    SqlAlchemyUserRepository,
)
from app.modules.identity.infrastructure.two_factor_repositories import (
    SqlAlchemyTwoFactorChallengeRepository,
    SqlAlchemyTwoFactorRepository,
)
from app.modules.notification.api.dependencies import get_email_sender
from app.modules.notification.domain.email_sender import EmailSender

_bearer_scheme = HTTPBearer(auto_error=True)
logger = logging.getLogger(__name__)


def get_google_verifier() -> GoogleTokenVerifier:
    return GoogleTokenInfoVerifier(app_settings)


def get_two_factor_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TwoFactorService:
    return TwoFactorService(
        SqlAlchemyTwoFactorRepository(session),
        SqlAlchemyTwoFactorChallengeRepository(session),
        FernetSecretCipher(app_settings.two_factor_encryption_key),
    )


def get_identity_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    email_sender: Annotated[EmailSender, Depends(get_email_sender)],
    google_verifier: Annotated[GoogleTokenVerifier, Depends(get_google_verifier)],
    two_factor: Annotated[TwoFactorService, Depends(get_two_factor_service)],
) -> IdentityService:
    users = SqlAlchemyUserRepository(session)
    sessions = SqlAlchemyRefreshSessionRepository(session)
    password_reset_tokens = SqlAlchemyPasswordResetTokenRepository(session)
    email_verification_tokens = SqlAlchemyEmailVerificationTokenRepository(session)
    return IdentityService(
        users,
        sessions,
        password_reset_tokens,
        email_sender,
        google_verifier,
        email_verification_tokens,
        SqlAlchemyTermsAcceptanceRepository(session),
        two_factor,
    )


async def get_current_session(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
    service: Annotated[IdentityService, Depends(get_identity_service)],
) -> AuthenticatedSession:
    try:
        return await service.resolve_session(credentials.credentials)
    except (InvalidTokenError, UserNotFoundError, InactiveUserError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# Mensajes del 403 de una sesión admin sin la verificación en dos pasos. El
# `code` es el que mira el frontend (`lib/api.ts`) para llevar a la pantalla
# de alta o de vuelta al login.
TWO_FACTOR_GATE_MESSAGES: dict[AdminGate, str] = {
    AdminGate.SETUP_REQUIRED: "Activá la verificación en dos pasos para usar el panel de admin.",
    AdminGate.VERIFICATION_REQUIRED: "Volvé a ingresar con el código de tu app autenticadora.",
}


def two_factor_gate_error(gate: AdminGate) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": gate.value, "message": TWO_FACTOR_GATE_MESSAGES[gate]},
    )


async def get_current_user(
    session: Annotated[AuthenticatedSession, Depends(get_current_session)],
) -> User:
    """Usuario autenticado, para todos los endpoints.

    Una sesión admin sin la verificación en dos pasos (sin activar, o de
    antes de activarla) recibe 403 con un `code` en TODO endpoint que use
    esta dependencia, no sólo en `/admin`: el rol admin también abre cosas en
    endpoints compartidos (tickets ajenos, el CV de un trabajador, el mapa de
    trabajadores, el WebSocket), y un endpoint nuevo queda cubierto solo
    (falla cerrado). Las únicas excepciones usan
    `get_current_user_allow_pending_2fa`: `/auth/me` y el alta (ADR-0023)."""
    gate = session.gate
    if gate is not AdminGate.GRANTED:
        logger.warning(
            "403 admin sin verificación en dos pasos: user_id=%s code=%s",
            session.user.id,
            gate.value,
        )
        raise two_factor_gate_error(gate)
    return session.user


async def get_current_user_allow_pending_2fa(
    session: Annotated[AuthenticatedSession, Depends(get_current_session)],
) -> User:
    """Como `get_current_user` pero deja pasar a un admin sin la
    verificación. Sólo para `/auth/me` y los endpoints del alta: es lo único
    que tiene que poder hacer esa sesión."""
    return session.user


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
        auth = await service.resolve_session(token)
    except (InvalidTokenError, UserNotFoundError, InactiveUserError) as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION) from exc
    finally:
        await session.close()
    # Mismo candado que `get_current_user` (ADR-0023).
    if auth.gate is not AdminGate.GRANTED:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    return auth.user


def per_account_quota_key(user: User, request: Request, account_key: str | None = None) -> str:
    """Clave de un límite "por cuenta" (p. ej. los límites cortos y los topes diarios de la IA).
    `account_key` es lo que identifica a la cuenta (default: el id del
    usuario; el asistente del comercio usa el id del comercio).

    Las cuentas invitadas de la beta son UNA por rol, compartida por todos
    los que entran con el PIN: por cuenta sola, entre todos agotaban el tope
    y la IA quedaba en 429 para todos (revisión 2026-10-21). Para ellas la
    clave es cuenta + IP real del cliente (`client_ip`, la de Cloudflare)."""
    key = account_key or str(user.id)
    if user.email in GUEST_ACCOUNT_EMAILS:
        return f"{key}:{client_ip(request)}"
    return key


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Factory de dependencia que exige que el usuario tenga uno de los roles dados."""

    async def _checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in roles:
            # PRODUCTION_HARDENING.md: se loguea el id (no el email, para no
            # dejar PII en logs) — alcanza para correlacionar abuso repetido
            # de una misma cuenta sin exponer datos personales.
            logger.warning(
                "403 permisos insuficientes: user_id=%s rol=%s roles_requeridos=%s",
                current_user.id,
                current_user.role.value,
                [r.value for r in roles],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return current_user

    return _checker
