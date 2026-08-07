"""Rutas HTTP del módulo de identidad (autenticación y perfil básico)."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.rate_limit import RateLimiter
from app.modules.identity.api.dependencies import (
    get_current_user,
    get_identity_service,
)
from app.modules.identity.api.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    GoogleRoleRequiredResponse,
    GuestLoginRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    ResetPasswordRequest,
    TokenResponse,
    UpdateMeRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.modules.identity.application.dtos import (
    GoogleLoginCommand,
    GoogleRoleRequired,
    LoginCommand,
    RegisterCommand,
)
from app.modules.identity.application.services import IdentityService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    EmailAlreadyExistsError,
    EmailVerificationTokenInvalidError,
    GoogleAuthNotConfiguredError,
    GoogleEmailNotVerifiedError,
    GoogleTokenInvalidError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidGuestPinError,
    InvalidTokenError,
    PasswordResetTokenInvalidError,
    RefreshTokenRevokedError,
    UserNotFoundError,
)
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/auth", tags=["identity"])
logger = logging.getLogger(__name__)

ServiceDep = Annotated[IdentityService, Depends(get_identity_service)]

# Límite por IP para frenar fuerza bruta / abuso de alta de cuentas.
_login_rate_limit = RateLimiter(max_attempts=10, window_seconds=60, name="login")
_register_rate_limit = RateLimiter(
    max_attempts=5, window_seconds=60, name="register"
)
# Mismo criterio que login/register: frena abuso (spam de emails) por IP.
# El rate-limit "de negocio" (no reenviar si ya hay un token vigente hace
# <5 min) vive en `IdentityService.request_password_reset`.
_forgot_password_rate_limit = RateLimiter(
    max_attempts=5, window_seconds=60, name="forgot_password"
)
_google_auth_rate_limit = RateLimiter(
    max_attempts=10, window_seconds=60, name="google_auth"
)
# Acceso de invitado por PIN: límite por IP para frenar la fuerza bruta del PIN.
_guest_rate_limit = RateLimiter(max_attempts=10, window_seconds=60, name="guest")
# PRODUCTION_HARDENING.md: antes sin límite — a diferencia de login/register,
# un refresh token robado se podía usar para renovar sin ningún throttle.
_refresh_rate_limit = RateLimiter(max_attempts=20, window_seconds=60, name="refresh")
# Mismo criterio que _forgot_password_rate_limit: frena spam de emails por
# IP; el rate-limit "de negocio" vive en `IdentityService.resend_verification_email`.
_resend_verification_rate_limit = RateLimiter(
    max_attempts=5, window_seconds=60, name="resend_verification"
)


def _client_ip(request: Request) -> str:
    client = request.client
    return client.host if client else "unknown"


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
async def login(payload: LoginRequest, service: ServiceDep, request: Request) -> TokenResponse:
    try:
        tokens = await service.authenticate(
            LoginCommand(email=payload.email, password=payload.password)
        )
    except InvalidCredentialsError as exc:
        logger.warning("login fallido (credenciales inválidas) ip=%s", _client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        ) from exc
    except InactiveUserError as exc:
        logger.warning("login rechazado (cuenta inactiva) ip=%s", _client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta no está activa",
        ) from exc
    return TokenResponse(**tokens.__dict__)


@router.post(
    "/guest",
    response_model=TokenResponse,
    summary="Entrar como invitado (beta) con un PIN, sin registrarse",
    dependencies=[Depends(_guest_rate_limit)],
)
async def guest_login(
    payload: GuestLoginRequest, service: ServiceDep, request: Request
) -> TokenResponse:
    """Acceso para testers de la beta: con el PIN correcto entra en una cuenta
    invitada compartida del rol elegido (trabajador o comercio), sin registro.
    El PIN se configura en el código (`IdentityService.GUEST_ACCESS_PIN`)."""
    try:
        tokens = await service.guest_login(
            payload.pin, UserRole(payload.role.value)
        )
    except InvalidGuestPinError as exc:
        logger.warning("guest login: PIN inválido ip=%s", _client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN incorrecto"
        ) from exc
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta de invitado no está activa",
        ) from exc
    return TokenResponse(**tokens.__dict__)


@router.post(
    "/google",
    summary="Ingresar o registrarse con Google",
    dependencies=[Depends(_google_auth_rate_limit)],
)
async def google_auth(
    payload: GoogleAuthRequest, service: ServiceDep
) -> TokenResponse | GoogleRoleRequiredResponse:
    """Ver docs/reference/ACCESO_MODERNO.md. Devuelve `TokenResponse` (mismo contrato
    que `/auth/login`) si el email ya tiene cuenta o si se indicó `role` para
    crear una; devuelve `GoogleRoleRequiredResponse` si el email es nuevo y
    todavía no se eligió rol — el frontend debe preguntar y reintentar."""
    try:
        result = await service.authenticate_google(
            GoogleLoginCommand(
                id_token=payload.id_token,
                role=UserRole(payload.role.value) if payload.role else None,
            )
        )
    except GoogleAuthNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth no está configurado en este servidor",
        ) from exc
    except GoogleTokenInvalidError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google inválido o expirado",
        ) from exc
    except GoogleEmailNotVerifiedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google no verificó este email",
        ) from exc
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta no está activa",
        ) from exc

    if isinstance(result, GoogleRoleRequired):
        return GoogleRoleRequiredResponse(email=result.email, full_name=result.full_name)
    return TokenResponse(**result.__dict__)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar tokens",
    dependencies=[Depends(_refresh_rate_limit)],
)
async def refresh(payload: RefreshRequest, service: ServiceDep, request: Request) -> TokenResponse:
    try:
        tokens = await service.refresh(payload.refresh_token)
    except RefreshTokenRevokedError as exc:
        # jti reusado tras revocación = señal de robo (ver IdentityService.refresh,
        # que ya revoca todas las sesiones del usuario). Vale la pena distinguirlo
        # en el log de los simples "vencido"/"formato inválido" de abajo.
        logger.warning("refresh con jti revocado/reusado (posible robo) ip=%s", _client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        ) from exc
    except (InvalidTokenError, UserNotFoundError) as exc:
        # No-disclosure: misma respuesta que el caso de arriba.
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


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar sesión (revoca el refresh token)",
)
async def logout(payload: RefreshRequest, service: ServiceDep) -> None:
    try:
        await service.logout(payload.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        ) from exc


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Datos del usuario autenticado",
)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Editar el nombre del usuario autenticado",
)
async def update_me(
    payload: UpdateMeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ServiceDep,
) -> User:
    return await service.update_full_name(current_user.id, payload.full_name)


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Pedir recuperación de contraseña",
    dependencies=[Depends(_forgot_password_rate_limit)],
)
async def forgot_password(
    payload: ForgotPasswordRequest, service: ServiceDep
) -> ForgotPasswordResponse:
    """Siempre responde 202 con el mismo body, exista o no el usuario
    (anti-enumeración): el caso de uso decide en silencio si corresponde
    generar y mandar un token nuevo."""
    await service.request_password_reset(payload.email)
    return ForgotPasswordResponse()


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Restablecer contraseña con el token del email",
)
async def reset_password(payload: ResetPasswordRequest, service: ServiceDep) -> None:
    try:
        await service.reset_password(payload.token, payload.new_password)
    except PasswordResetTokenInvalidError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enlace inválido o vencido",
        ) from exc


@router.post(
    "/verify-email",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Confirmar el email con el token enviado por correo",
)
async def verify_email(payload: VerifyEmailRequest, service: ServiceDep) -> None:
    try:
        await service.verify_email(payload.token)
    except EmailVerificationTokenInvalidError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enlace inválido o vencido",
        ) from exc


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Reenviar el email de verificación",
    dependencies=[Depends(_resend_verification_rate_limit)],
)
async def resend_verification(
    payload: ResendVerificationRequest, service: ServiceDep
) -> ResendVerificationResponse:
    """Siempre responde 202 con el mismo body, exista o no el usuario y esté
    o no ya verificado (anti-enumeración, mismo criterio que
    `forgot_password`)."""
    await service.resend_verification_email(payload.email)
    return ResendVerificationResponse()
