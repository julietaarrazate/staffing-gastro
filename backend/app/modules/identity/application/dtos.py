"""DTOs internos de la capa de aplicación.

Separan los comandos/resultados de los casos de uso de los esquemas HTTP (API).
"""

from dataclasses import dataclass

from app.modules.identity.domain.entities import User
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
    # Usuario ya resuelto al emitir los tokens (login/google/refresh ya lo
    # tienen en mano): se devuelve embebido para que el cliente no tenga que
    # encadenar un `GET /auth/me` tras entrar — un round-trip menos al backend
    # remoto en cada login y en cada arranque de la app (ver auth-context).
    user: User
    token_type: str = "bearer"


@dataclass(frozen=True)
class GoogleLoginCommand:
    """`role` sólo se usa si hay que dar de alta una cuenta nueva (ver
    `GoogleRoleRequired`); se ignora si el email ya tiene cuenta."""

    id_token: str
    role: UserRole | None = None


@dataclass(frozen=True)
class GoogleRoleRequired:
    """El token de Google es válido pero el email no tiene cuenta todavía y
    no se indicó `role`: el frontend debe mostrar la pantalla "¿Buscás
    trabajo o buscás personal?" y reintentar `POST /auth/google` con el rol
    elegido (mismo `id_token`, todavía vigente)."""

    email: str
    full_name: str


GoogleLoginResult = TokenPair | GoogleRoleRequired
