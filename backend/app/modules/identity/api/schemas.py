"""Esquemas HTTP (Pydantic) del módulo de identidad.

Definen el contrato de la API (request/response) — separados de los DTOs
de aplicación y de las entidades de dominio.
"""

from datetime import date, datetime
from enum import Enum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.identity.domain.origen_alta import OrigenAlta
from app.modules.identity.domain.value_objects import UserRole, UserStatus


class RegisterableRole(str, Enum):
    """Roles que un usuario puede elegir al registrarse por su cuenta.

    ADMIN queda deliberadamente afuera: no es un rol autoasignable desde el
    registro público.
    """

    WORKER = "worker"
    EMPLOYER = "employer"


def _reject_repeated_char(value: str) -> str:
    """Regla mínima de clave, la misma en registro y reset: un único carácter
    repetido («aaaaaaaa», «11111111») no cuenta como clave."""
    if len(set(value)) == 1:
        raise ValueError(
            "La contraseña no puede ser un solo carácter repetido. "
            "Combiná letras y números."
        )
    return value


class OrigenAltaRequest(BaseModel):
    """Los parámetros del enlace con el que llegó la persona (`?ref=`,
    `utm_source`, `utm_campaign`), tal como los guardó el navegador. Nunca
    frena un alta: lo que no es texto se ignora y lo largo se recorta; la
    etiqueta que se guarda la arma `domain/origen_alta.py`."""

    ref: str | None = None
    utm_source: str | None = None
    utm_campaign: str | None = None

    @field_validator("ref", "utm_source", "utm_campaign", mode="before")
    @classmethod
    def _solo_texto_corto(cls, value: object) -> str | None:
        return value[:200] if isinstance(value, str) else None

    def to_domain(self) -> OrigenAlta:
        return OrigenAlta(ref=self.ref, utm_source=self.utm_source, utm_campaign=self.utm_campaign)


def _origen_tolerante(value: object) -> object:
    """Un `origen` que no es un objeto (un string, una lista) se ignora en
    vez de rechazar el alta con un 422."""
    return value if isinstance(value, dict | OrigenAltaRequest) else None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: RegisterableRole = RegisterableRole.WORKER
    # El checkbox de términos y privacidad. Tiene que llegar en True: la ruta
    # rechaza el alta sin él y guarda la constancia (`TermsAcceptance`).
    accepted_terms: bool = False
    # U101: obligatoria (la ruta responde 422 con un texto claro si falta o si
    # la persona es menor de 18). Opcional en el esquema para que el mensaje
    # sea ése y no el genérico de Pydantic.
    birth_date: date | None = None
    # De qué enlace llegó (fase 0 del plan de crecimiento). Opcional.
    origen: OrigenAltaRequest | None = None

    _origen = field_validator("origen", mode="before")(_origen_tolerante)

    @field_validator("full_name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Escribí tu nombre")
        return stripped

    _password_rule = field_validator("password")(_reject_repeated_char)


class UpdateMeRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("full_name")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El nombre no puede estar vacío")
        return stripped


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GuestLoginRequest(BaseModel):
    """Acceso de invitado para la beta ("Explorar sin cuenta"): sólo el PIN y
    qué lado querés probar (trabajador o comercio)."""

    pin: str = Field(min_length=1, max_length=64)
    role: RegisterableRole = RegisterableRole.WORKER


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Body genérico, siempre igual exista o no el usuario (anti-enumeración)."""

    message: str = "Si el email existe, te enviamos un enlace para restablecer tu contraseña."


class ResetPasswordRequest(BaseModel):
    token: str
    # Misma regla que el registro (`RegisterRequest.password`): no se
    # inventan reglas nuevas para el reset.
    new_password: str = Field(min_length=8, max_length=128)
    _password_rule = field_validator("new_password")(_reject_repeated_char)


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ResendVerificationResponse(BaseModel):
    """Body genérico, siempre igual exista o no el usuario / ya esté
    verificado (anti-enumeración, mismo criterio que `ForgotPasswordResponse`)."""

    message: str = "Si el email existe y todavía no está verificado, te enviamos un enlace."


class TokenResponse(BaseModel):
    access_token: str
    # TECH_DEBT.md S1: el refresh token YA NO viaja en el body — se emite
    # como cookie httpOnly (`Set-Cookie`, ver `api/routes.py::_set_refresh_
    # cookie`). Si siguiera acá, un XSS que hookee `fetch`/`XHR` podría leerlo
    # de la respuesta igual, sin importar dónde lo guarde el frontend — la
    # cookie httpOnly sólo protege de verdad si el token nunca toca JS.
    token_type: str = "bearer"
    # Usuario embebido: presente en login/google/refresh para ahorrarle al
    # cliente un `GET /auth/me` tras entrar (un round-trip menos al backend
    # remoto). Forward-ref porque `UserResponse` se define más abajo; se
    # resuelve con `TokenResponse.model_rebuild()` al final del módulo.
    user: "UserResponse | None" = None
    # Admin sin la verificación en dos pasos: la sesión sólo le deja activarla
    # (ADR-0023). Lo mismo que `MeResponse`, para el login.
    two_factor_setup_required: bool = False


class GoogleAuthRequest(BaseModel):
    """`role` sólo hace falta si el email todavía no tiene cuenta (ver
    `GoogleRoleRequiredResponse`) — se ignora si ya existe."""

    id_token: str
    role: RegisterableRole | None = None
    # Obligatorio en True cuando viene `role`, o sea cuando se crea la cuenta.
    accepted_terms: bool = False
    # Igual que en el registro con email: obligatoria al crear la cuenta (U101).
    birth_date: date | None = None
    # Igual que en el registro con email; sólo cuenta al crear la cuenta.
    origen: OrigenAltaRequest | None = None

    _origen = field_validator("origen", mode="before")(_origen_tolerante)


class GoogleRoleRequiredResponse(BaseModel):
    """El frontend debe mostrar la pantalla de selección de rol y reintentar
    `POST /auth/google` con el mismo `id_token` + el rol elegido."""

    requires_role: bool = True
    email: EmailStr
    full_name: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    status: UserStatus
    is_verified: bool
    created_at: datetime | None = None


class MeResponse(UserResponse):
    """`GET /auth/me`: el usuario y, para un admin sin la verificación en dos
    pasos activada, `two_factor_setup_required` (ADR-0023). Así el frontend
    sabe al abrir la sesión que sólo puede ir al alta y no dispara pedidos que
    el backend rechaza con 403."""

    two_factor_setup_required: bool = False


# Resuelve el forward-ref `user: "UserResponse"` de TokenResponse ahora que
# UserResponse ya está definido.
TokenResponse.model_rebuild()


# --- Verificación en dos pasos (ADR-0023) ------------------------------------

# Un código de la app (6 dígitos) o uno de recuperación (`xxxx-xxxx-xxxx`,
# con o sin guiones ni espacios).
TwoFactorCode = Annotated[str, Field(min_length=6, max_length=32)]


class TwoFactorChallengeResponse(BaseModel):
    """Respuesta de `/auth/login` y `/auth/google` para un admin con la
    verificación activa: todavía no hay sesión. El frontend pide el código y
    lo manda con este token a `POST /auth/2fa/verify`."""

    two_factor_required: bool = True
    challenge_token: str
    expires_in: int


class TwoFactorVerifyRequest(BaseModel):
    challenge_token: str = Field(min_length=1, max_length=128)
    code: TwoFactorCode


class TwoFactorVerifyResponse(TokenResponse):
    used_recovery_code: bool = False
    recovery_codes_left: int


class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    enabled_at: datetime | None = None
    recovery_codes_left: int


class TwoFactorSetupRequest(BaseModel):
    """`code` sólo hace falta para cambiar de celular (la verificación ya
    está activa): un código actual, de la app o de recuperación."""

    code: str | None = Field(default=None, min_length=6, max_length=32)


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TwoFactorCodeRequest(BaseModel):
    code: TwoFactorCode


class TwoFactorConfirmResponse(TokenResponse):
    """Sesión nueva, ya verificada, y los códigos de recuperación: se
    muestran esta única vez."""

    recovery_codes: list[str]


class RecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]
