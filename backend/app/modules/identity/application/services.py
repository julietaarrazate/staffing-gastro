"""Casos de uso del módulo de identidad.

Orquesta dominio + puertos (repositorio) + utilidades de seguridad.
No conoce detalles de HTTP ni de SQLAlchemy.
"""

from uuid import UUID

import jwt

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
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    EmailAlreadyExistsError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidTokenError,
    UserNotFoundError,
)
from app.modules.identity.domain.repositories import UserRepository


class IdentityService:
    """Servicio de aplicación que agrupa los casos de uso de autenticación."""

    def __init__(self, users: UserRepository) -> None:
        self._users = users

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
        return self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenPair:
        """Emite un nuevo par de tokens a partir de un refresh token válido."""
        try:
            payload = decode_token(refresh_token)
        except jwt.PyJWTError as exc:
            raise InvalidTokenError() from exc

        if payload.get("type") != REFRESH_TOKEN:
            raise InvalidTokenError()

        user = await self._users.get_by_id(UUID(payload["sub"]))
        if user is None:
            raise UserNotFoundError()
        if not user.is_active:
            raise InactiveUserError()
        return self._issue_tokens(user)

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

    @staticmethod
    def _issue_tokens(user: User) -> TokenPair:
        claims = {"role": user.role.value}
        return TokenPair(
            access_token=create_access_token(str(user.id), extra_claims=claims),
            refresh_token=create_refresh_token(str(user.id)),
        )
