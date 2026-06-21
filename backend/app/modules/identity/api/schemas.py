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


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    status: UserStatus
    is_verified: bool
    created_at: datetime | None = None
