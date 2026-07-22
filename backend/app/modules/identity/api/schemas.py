"""Esquemas HTTP (Pydantic) del módulo de identidad.

Definen el contrato de la API (request/response) — separados de los DTOs
de aplicación y de las entidades de dominio.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.identity.domain.value_objects import UserRole, UserStatus


class RegisterableRole(str, Enum):
    """Roles que un usuario puede elegir al registrarse por su cuenta.

    ADMIN queda deliberadamente afuera: no es un rol autoasignable desde el
    registro público.
    """

    WORKER = "worker"
    EMPLOYER = "employer"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: RegisterableRole = RegisterableRole.WORKER


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


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


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # Usuario embebido: presente en login/google/refresh para ahorrarle al
    # cliente un `GET /auth/me` tras entrar (un round-trip menos al backend
    # remoto). Forward-ref porque `UserResponse` se define más abajo; se
    # resuelve con `TokenResponse.model_rebuild()` al final del módulo.
    user: "UserResponse | None" = None


class GoogleAuthRequest(BaseModel):
    """`role` sólo hace falta si el email todavía no tiene cuenta (ver
    `GoogleRoleRequiredResponse`) — se ignora si ya existe."""

    id_token: str
    role: RegisterableRole | None = None


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


# Resuelve el forward-ref `user: "UserResponse"` de TokenResponse ahora que
# UserResponse ya está definido.
TokenResponse.model_rebuild()
