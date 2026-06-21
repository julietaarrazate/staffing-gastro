"""DTOs internos de la capa de aplicación.

Separan los comandos/resultados de los casos de uso de los esquemas HTTP (API).
"""

from dataclasses import dataclass

from app.modules.identity.domain.value_objects import UserRole


@dataclass(frozen=True)
class RegisterCommand:
    email: str
    password: str
    full_name: str
    role: UserRole


@dataclass(frozen=True)
class LoginCommand:
    email: str
    password: str


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
