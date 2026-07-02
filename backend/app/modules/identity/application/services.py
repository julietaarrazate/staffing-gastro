"""Casos de uso del módulo de identidad.

Orquesta dominio + puertos (repositorio) + utilidades de seguridad.
No conoce detalles de HTTP ni de SQLAlchemy.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN,
    REFRESH_TOKEN,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.identity.application.dtos import (
    LoginCommand,
    RegisterCommand,
    TokenPair,
)
from app.modules.identity.domain.entities import RefreshSession, User
from app.modules.identity.domain.exceptions import (
    EmailAlreadyExistsError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidTokenError,
    RefreshTokenRevokedError,
    UserNotFoundError,
)
from app.modules.identity.domain.repositories import (
    RefreshSessionRepository,
    UserRepository,
)


class IdentityService:
    """Servicio de aplicación que agrupa los casos de uso de autenticación."""

    def __init__(self, users: UserRepository, sessions: RefreshSessionRepository) -> None:
        self._users = users
        self._sessions = sessions

    async def register(self, command: RegisterCommand) -> User:
        """Registra un nuevo usuario. Falla si el email ya existe."""
        if await self._users.exists_by_email(command.email):
            raise EmailAlreadyExistsError(command.email)

        user = User(
            email=command.email.lower(),
            hashed_password=hash_password(command.password),
            full_name=command.full_name,
            role=command.role,
        )
        return await self._users.add(user)

    async def authenticate(self, command: LoginCommand) -> TokenPair:
        """Valida credenciales y devuelve un par de tokens."""
        user = await self._users.get_by_email(command.email)
        if user is None or not verify_password(command.password, user.hashed_password):
            raise InvalidCredentialsError()
        if not user.is_active:
            raise InactiveUserError()
        return await self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenPair:
        """Emite un nuevo par de tokens a partir de un refresh token válido.

        Rotación (ADR-0002): el refresh usado queda revocado y se emite uno
        nuevo. Si el `jti` recibido ya estaba revocado, se interpreta como
        reuso de un token viejo (posible robo): se revocan **todas** las
        sesiones del usuario y se rechaza la operación.
        """
        jti = self._decode_refresh(refresh_token)

        session = await self._sessions.get_by_jti(jti)
        if session is None:
            raise InvalidTokenError()
        if session.is_revoked:
            await self._sessions.revoke_all_for_user(session.user_id)
            raise RefreshTokenRevokedError()

        user = await self._users.get_by_id(session.user_id)
        if user is None:
            raise UserNotFoundError()
        if not user.is_active:
            raise InactiveUserError()

        await self._sessions.revoke(jti)
        return await self._issue_tokens(user)

    async def logout(self, refresh_token: str) -> None:
        """Revoca la sesión asociada al refresh token dado (cierre de sesión)."""
        jti = self._decode_refresh(refresh_token)
        session = await self._sessions.get_by_jti(jti)
        if session is None:
            raise InvalidTokenError()
        await self._sessions.revoke(jti)

    async def get_current_user(self, access_token: str) -> User:
        """Resuelve el usuario a partir de un access token (para dependencias)."""
        try:
            payload = decode_token(access_token)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError() from exc

        if payload.get("type") != ACCESS_TOKEN:
            raise InvalidTokenError()

        user = await self._users.get_by_id(UUID(payload["sub"]))
        if user is None:
            raise UserNotFoundError()
        if not user.is_active:
            raise InactiveUserError()
        return user

    async def _issue_tokens(self, user: User) -> TokenPair:
        """Emite un par de tokens y persiste la sesión del refresh (ADR-0002)."""
        jti = str(uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        await self._sessions.add(
            RefreshSession(user_id=user.id, jti=jti, expires_at=expires_at)
        )
        claims = {"role": user.role.value}
        return TokenPair(
            access_token=create_access_token(str(user.id), extra_claims=claims),
            refresh_token=create_refresh_token(str(user.id), jti=jti),
        )

    @staticmethod
    def _decode_refresh(refresh_token: str) -> str:
        """Decodifica un refresh token y devuelve su `jti`, o lanza InvalidTokenError."""
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError() from exc

        if payload.get("type") != REFRESH_TOKEN:
            raise InvalidTokenError()

        jti = payload.get("jti")
        if not jti:
            raise InvalidTokenError()
        return jti
