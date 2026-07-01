"""Rutas HTTP del módulo de identidad (autenticación y perfil básico)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.rate_limit import RateLimiter
from app.modules.identity.api.dependencies import (
    get_current_user,
    get_identity_service,
)
from app.modules.identity.api.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.modules.identity.application.dtos import LoginCommand, RegisterCommand
from app.modules.identity.application.services import IdentityService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    EmailAlreadyExistsError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidTokenError,
    UserNotFoundError,
)
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/auth", tags=["identity"])

ServiceDep = Annotated[IdentityService, Depends(get_identity_service)]

# Límite por IP para frenar fuerza bruta / abuso de alta de cuentas.
_login_rate_limit = RateLimiter(max_attempts=10, window_seconds=60, name="login")
_register_rate_limit = RateLimiter(
    max_attempts=5, window_seconds=60, name="register"
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo usuario",
    dependencies=[Depends(_register_rate_limit)],
)
async def register(payload: RegisterRequest, service: ServiceDep) -> User:
    try:
        return await service.register(
            RegisterCommand(
                email=payload.email,
                password=payload.password,
                full_name=payload.full_name,
                role=UserRole(payload.role.value),
            )
        )
    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado",
        ) from exc


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
    dependencies=[Depends(_login_rate_limit)],
)
async def login(payload: LoginRequest, service: ServiceDep) -> TokenResponse:
    try:
        tokens = await service.authenticate(
            LoginCommand(email=payload.email, password=payload.password)
        )
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        ) from exc
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta no está activa",
        ) from exc
    return TokenResponse(**tokens.__dict__)


@router.post("/refresh", response_model=TokenResponse, summary="Renovar tokens")
async def refresh(payload: RefreshRequest, service: ServiceDep) -> TokenResponse:
    try:
        tokens = await service.refresh(payload.refresh_token)
    except (InvalidTokenError, UserNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        ) from exc
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta no está activa",
        ) from exc
    return TokenResponse(**tokens.__dict__)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Datos del usuario autenticado",
)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user
