"""Rutas HTTP del módulo de identidad (autenticación y perfil básico)."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import settings
from app.core.edge import client_ip
from app.core.origin import require_allowed_origin
from app.core.log_privacy import email_log_key
from app.core.rate_limit import RateLimiter
from app.core.turnstile import require_turnstile
from app.modules.identity.api.dependencies import (
    get_current_session,
    get_current_user,
    get_current_user_allow_pending_2fa,
    get_identity_service,
    get_two_factor_service,
    two_factor_gate_error,
)
from app.modules.identity.api.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    GoogleRoleRequiredResponse,
    GuestLoginRequest,
    LoginRequest,
    RecoveryCodesResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    ResetPasswordRequest,
    TokenResponse,
    TwoFactorChallengeResponse,
    TwoFactorCodeRequest,
    TwoFactorConfirmResponse,
    TwoFactorSetupRequest,
    TwoFactorSetupResponse,
    TwoFactorStatusResponse,
    TwoFactorVerifyRequest,
    TwoFactorVerifyResponse,
    UpdateMeRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.modules.identity.application.dtos import (
    AuthenticatedSession,
    GoogleLoginCommand,
    GoogleRoleRequired,
    LoginCommand,
    RegisterCommand,
)
from app.modules.identity.application.services import IdentityService
from app.modules.identity.application.two_factor import (
    TwoFactorChallengeIssued,
    TwoFactorService,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.exceptions import (
    EmailAlreadyExistsError,
    EmailVerificationTokenInvalidError,
    GoogleAuthNotConfiguredError,
    GoogleEmailNotVerifiedError,
    GoogleTokenInvalidError,
    GuestAccessDisabledError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidGuestPinError,
    InvalidTokenError,
    PasswordResetTokenInvalidError,
    RefreshTokenRevokedError,
    TwoFactorChallengeInvalidError,
    TwoFactorCodeInvalidError,
    TwoFactorEnrollmentNotStartedError,
    TwoFactorNotAllowedError,
    TwoFactorNotConfiguredError,
    TwoFactorNotEnabledError,
    TwoFactorReauthRequiredError,
    TwoFactorTooManyAttemptsError,
    UserNotFoundError,
)
from app.modules.identity.domain.two_factor import AdminGate
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/auth", tags=["identity"])
logger = logging.getLogger(__name__)

ServiceDep = Annotated[IdentityService, Depends(get_identity_service)]
TwoFactorDep = Annotated[TwoFactorService, Depends(get_two_factor_service)]

# Límite por IP para frenar fuerza bruta / abuso de alta de cuentas.
_login_rate_limit = RateLimiter(max_attempts=10, window_seconds=60, name="login")
# Además del límite por IP, uno por cuenta: rotando IPs se podía probar
# contraseñas sin límite contra un mismo email (revisión de seguridad
# 2026-10-20). Cuenta solo los intentos fallidos (revisión 2026-10-21): ver
# `login`. Generoso para no trabar a quien se equivoca de verdad.
_login_per_email_rate_limit = RateLimiter(
    max_attempts=20, window_seconds=900, name="login_per_email"
)
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
# Verificación en dos pasos (ADR-0023): el paso del código del login, igual
# que el login por IP. Además del tope por desafío y por cuenta, que viven en
# la base (`TwoFactorService.verify_challenge`) y no dependen de la IP.
_two_factor_verify_rate_limit = RateLimiter(
    max_attempts=10, window_seconds=60, name="two_factor_verify"
)
# Alta, cambio de celular y códigos nuevos (sesión admin ya abierta).
_two_factor_manage_rate_limit = RateLimiter(
    max_attempts=10, window_seconds=60, name="two_factor_manage"
)


def _client_ip(request: Request) -> str:
    return client_ip(request)


# --- Refresh token como cookie httpOnly (TECH_DEBT.md S1) -----------------
# Antes viajaba en el body de la respuesta y se guardaba en `localStorage`
# (frontend/lib/auth-context.tsx): un XSS podía leerlo y usarlo hasta sus 30
# días completos de vigencia, incluso después de un "logout" (que sólo
# borraba el localStorage local). Ahora nunca toca JS: el backend lo emite
# como cookie `HttpOnly` y el frontend nunca lo guarda ni lo reenvía a mano
# (sólo `credentials: "include"` para que el navegador la adjunte solo). El
# access token (15 min) sigue viajando en el body/`localStorage` sin cambios
# — su ventana de exposición ya es chica.
_REFRESH_COOKIE_NAME = "staffya_refresh"
# Acotada al propio router de auth: el navegador no la manda en el resto de
# la API, sólo en /auth/refresh y /auth/logout.
_REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        # `Secure` sólo puede faltar fuera de producción: en prod, frontend
        # (Vercel) y backend (Render) son *sitios* distintos y una cookie
        # `SameSite=None` exige `Secure` para que el navegador la acepte. En
        # dev ambos corren en `localhost` (mismo *site* pese al puerto
        # distinto), así que `Lax` alcanza sin necesitar HTTPS local.
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        path=_REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_REFRESH_COOKIE_NAME,
        path=_REFRESH_COOKIE_PATH,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
    )


def _terms_not_accepted() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail="Para crear la cuenta tenés que aceptar los términos y la política de privacidad",
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo usuario",
    dependencies=[Depends(_register_rate_limit), Depends(require_turnstile)],
)
async def register(payload: RegisterRequest, service: ServiceDep) -> User:
    if not payload.accepted_terms:
        raise _terms_not_accepted()
    try:
        return await service.register(
            RegisterCommand(
                email=payload.email,
                password=payload.password,
                full_name=payload.full_name,
                role=UserRole(payload.role.value),
                accepted_terms=True,
            )
        )
    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado",
        ) from exc


@router.post(
    "/login",
    summary="Iniciar sesión",
    dependencies=[Depends(_login_rate_limit), Depends(require_turnstile)],
)
async def login(
    payload: LoginRequest, service: ServiceDep, request: Request, response: Response
) -> TokenResponse | TwoFactorChallengeResponse:
    """`TokenResponse` con la sesión, o `TwoFactorChallengeResponse` si la
    cuenta es admin con la verificación en dos pasos activa: la sesión sale
    de `POST /auth/2fa/verify` con el código (ADR-0023)."""
    # Límite por email: cuenta solo los intentos FALLIDOS y se aplica después
    # de verificar la contraseña, así un tercero no puede bloquearle el login
    # al dueño (con la contraseña correcta nunca hay 429 por este límite).
    # Clave hasheada: el limitador loguea la clave en cada 429.
    email_key = email_log_key(payload.email)
    try:
        tokens = await service.authenticate(
            LoginCommand(email=payload.email, password=payload.password)
        )
    except InvalidCredentialsError as exc:
        logger.warning("login fallido (credenciales inválidas) ip=%s", _client_ip(request))
        if _login_per_email_rate_limit.is_exceeded(email_key):
            _login_per_email_rate_limit.reject(email_key)
        _login_per_email_rate_limit.record(email_key)
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
    if isinstance(tokens, TwoFactorChallengeIssued):
        return _challenge_response(tokens)
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(**tokens.__dict__)


def _challenge_response(issued: TwoFactorChallengeIssued) -> TwoFactorChallengeResponse:
    return TwoFactorChallengeResponse(
        challenge_token=issued.challenge_token, expires_in=issued.expires_in
    )


@router.post(
    "/guest",
    response_model=TokenResponse,
    summary="Entrar como invitado (beta) con un PIN, sin registrarse",
    dependencies=[Depends(_guest_rate_limit)],
)
async def guest_login(
    payload: GuestLoginRequest, service: ServiceDep, request: Request, response: Response
) -> TokenResponse:
    """Acceso para testers de la beta: con el PIN correcto entra en una cuenta
    invitada compartida del rol elegido (trabajador o comercio), sin registro.
    El PIN se configura con la env var `GUEST_ACCESS_PIN`; sin ella, 404."""
    try:
        tokens = await service.guest_login(
            payload.pin, UserRole(payload.role.value)
        )
    except GuestAccessDisabledError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El acceso de invitado no está disponible",
        ) from exc
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
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(**tokens.__dict__)


@router.post(
    "/google",
    summary="Ingresar o registrarse con Google",
    dependencies=[Depends(_google_auth_rate_limit)],
)
async def google_auth(
    payload: GoogleAuthRequest, service: ServiceDep, response: Response
) -> TokenResponse | GoogleRoleRequiredResponse | TwoFactorChallengeResponse:
    """Ver docs/reference/ACCESO_MODERNO.md. Devuelve `TokenResponse` (mismo contrato
    que `/auth/login`) si el email ya tiene cuenta o si se indicó `role` para
    crear una; devuelve `GoogleRoleRequiredResponse` si el email es nuevo y
    todavía no se eligió rol — el frontend debe preguntar y reintentar."""
    # `role` sólo viaja cuando se crea la cuenta, y crearla pide lo mismo que
    # el registro con email. Si la cuenta ya existe no se mira.
    if payload.role is not None and not payload.accepted_terms:
        raise _terms_not_accepted()
    try:
        result = await service.authenticate_google(
            GoogleLoginCommand(
                id_token=payload.id_token,
                role=UserRole(payload.role.value) if payload.role else None,
                accepted_terms=payload.accepted_terms,
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
    if isinstance(result, TwoFactorChallengeIssued):
        return _challenge_response(result)
    _set_refresh_cookie(response, result.refresh_token)
    return TokenResponse(**result.__dict__)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Renovar tokens",
    dependencies=[Depends(require_allowed_origin), Depends(_refresh_rate_limit)],
)
async def refresh(service: ServiceDep, request: Request, response: Response) -> TokenResponse:
    refresh_token = request.cookies.get(_REFRESH_COOKIE_NAME)
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )
    try:
        tokens = await service.refresh(refresh_token)
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
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(**tokens.__dict__)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar sesión (revoca el refresh token)",
    dependencies=[Depends(require_allowed_origin)],
)
async def logout(service: ServiceDep, request: Request, response: Response) -> None:
    refresh_token = request.cookies.get(_REFRESH_COOKIE_NAME)
    _clear_refresh_cookie(response)
    # Sin cookie no hay nada que revocar: logout no-op, no un error (a
    # diferencia de una cookie presente pero inválida, que sí es 401 abajo).
    if refresh_token is None:
        return
    try:
        await service.logout(refresh_token)
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
async def me(
    current_user: Annotated[User, Depends(get_current_user_allow_pending_2fa)],
) -> User:
    # También para un admin sin la verificación en dos pasos: el frontend
    # necesita saber quién es para llevarlo a activarla (ADR-0023).
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


# --- Verificación en dos pasos de las cuentas admin (ADR-0023) ---------------


def _two_factor_http_error(exc: Exception) -> HTTPException:
    """Traduce las excepciones de la verificación a HTTP. Las que el
    frontend tiene que distinguir llevan `code`."""
    if isinstance(exc, TwoFactorNotConfiguredError):
        logger.error("2FA sin TWO_FACTOR_ENCRYPTION_KEY válida: no se puede activar ni verificar")
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "two_factor_not_configured",
                "message": "La verificación en dos pasos no está configurada en el servidor.",
            },
        )
    if isinstance(exc, TwoFactorNotAllowedError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    if isinstance(exc, TwoFactorReauthRequiredError):
        return two_factor_gate_error(AdminGate.VERIFICATION_REQUIRED)
    if isinstance(exc, TwoFactorEnrollmentNotStartedError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La activación se reinició. Escaneá el código QR nuevo.",
        )
    if isinstance(exc, TwoFactorNotEnabledError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La verificación en dos pasos no está activa.",
        )
    if isinstance(exc, TwoFactorCodeInvalidError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El código no es válido."
        )
    raise exc


async def _admin_allow_pending_2fa(
    session: Annotated[AuthenticatedSession, Depends(get_current_session)],
) -> AuthenticatedSession:
    """Admin, con o sin la verificación: lo que puede usar mientras la
    activa. Otro rol, 403 como el resto de lo de admin."""
    if session.user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    return session


AdminPendingDep = Annotated[AuthenticatedSession, Depends(_admin_allow_pending_2fa)]


@router.get(
    "/2fa",
    response_model=TwoFactorStatusResponse,
    summary="Estado de la verificación en dos pasos (admin)",
)
async def two_factor_status(
    session: AdminPendingDep, two_factor: TwoFactorDep
) -> TwoFactorStatusResponse:
    status_ = await two_factor.status(session.user)
    return TwoFactorStatusResponse(**status_.__dict__)


@router.post(
    "/2fa/setup",
    response_model=TwoFactorSetupResponse,
    summary="Empezar la activación (o el cambio de celular) de la verificación en dos pasos",
    dependencies=[Depends(_two_factor_manage_rate_limit)],
)
async def two_factor_setup(
    payload: TwoFactorSetupRequest, session: AdminPendingDep, two_factor: TwoFactorDep
) -> TwoFactorSetupResponse:
    """Devuelve el secreto y el `otpauth://` del QR. Queda pendiente hasta
    `POST /auth/2fa/confirm`. Si ya está activa, pide una sesión verificada
    y un código actual (`code`)."""
    try:
        enrollment = await two_factor.start_enrollment(
            session.user,
            session_verified=session.two_factor_verified,
            current_code=payload.code,
        )
    except (
        TwoFactorNotConfiguredError,
        TwoFactorNotAllowedError,
        TwoFactorReauthRequiredError,
        TwoFactorCodeInvalidError,
    ) as exc:
        raise _two_factor_http_error(exc) from exc
    return TwoFactorSetupResponse(**enrollment.__dict__)


@router.post(
    "/2fa/confirm",
    response_model=TwoFactorConfirmResponse,
    summary="Confirmar la activación con un código de la app",
    dependencies=[Depends(_two_factor_manage_rate_limit)],
)
async def two_factor_confirm(
    payload: TwoFactorCodeRequest,
    session: AdminPendingDep,
    service: ServiceDep,
    response: Response,
) -> TwoFactorConfirmResponse:
    """Activa la verificación, cierra las demás sesiones de la cuenta y
    devuelve una sesión verificada con los códigos de recuperación (se
    muestran esta única vez)."""
    try:
        tokens, codes = await service.confirm_two_factor_enrollment(session, payload.code)
    except (
        TwoFactorNotConfiguredError,
        TwoFactorNotAllowedError,
        TwoFactorReauthRequiredError,
        TwoFactorEnrollmentNotStartedError,
        TwoFactorNotEnabledError,
        TwoFactorCodeInvalidError,
    ) as exc:
        raise _two_factor_http_error(exc) from exc
    _set_refresh_cookie(response, tokens.refresh_token)
    return TwoFactorConfirmResponse(**tokens.__dict__, recovery_codes=codes)


@router.post(
    "/2fa/verify",
    response_model=TwoFactorVerifyResponse,
    summary="Segundo paso del login: el código de la app o uno de recuperación",
    dependencies=[Depends(_two_factor_verify_rate_limit)],
)
async def two_factor_verify(
    payload: TwoFactorVerifyRequest, service: ServiceDep, request: Request, response: Response
) -> TwoFactorVerifyResponse:
    try:
        tokens, verified = await service.complete_two_factor_login(
            payload.challenge_token, payload.code
        )
    except TwoFactorCodeInvalidError as exc:
        logger.warning("2fa: código inválido ip=%s", _client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="El código no es válido."
        ) from exc
    except (
        TwoFactorChallengeInvalidError,
        TwoFactorNotEnabledError,
        UserNotFoundError,
    ) as exc:
        # No-disclosure: vencido, usado, quemado o inexistente, todo igual.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "two_factor_challenge_invalid",
                "message": "El ingreso venció. Volvé a poner tu contraseña.",
            },
        ) from exc
    except TwoFactorTooManyAttemptsError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados códigos incorrectos. Esperá 15 minutos y volvé a probar.",
        ) from exc
    except TwoFactorNotConfiguredError as exc:
        raise _two_factor_http_error(exc) from exc
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="La cuenta no está activa"
        ) from exc
    _set_refresh_cookie(response, tokens.refresh_token)
    return TwoFactorVerifyResponse(
        **tokens.__dict__,
        used_recovery_code=verified.used_recovery_code,
        recovery_codes_left=verified.recovery_codes_left,
    )


@router.post(
    "/2fa/recovery-codes",
    response_model=RecoveryCodesResponse,
    summary="Generar códigos de recuperación nuevos (los anteriores dejan de servir)",
    dependencies=[Depends(_two_factor_manage_rate_limit)],
)
async def two_factor_recovery_codes(
    payload: TwoFactorCodeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    two_factor: TwoFactorDep,
) -> RecoveryCodesResponse:
    """Pide sesión verificada (`get_current_user`, el candado normal) y un
    código actual, de la app o de recuperación."""
    try:
        codes = await two_factor.regenerate_recovery_codes(current_user, payload.code)
    except (
        TwoFactorNotConfiguredError,
        TwoFactorNotAllowedError,
        TwoFactorNotEnabledError,
        TwoFactorCodeInvalidError,
    ) as exc:
        raise _two_factor_http_error(exc) from exc
    return RecoveryCodesResponse(recovery_codes=codes)
