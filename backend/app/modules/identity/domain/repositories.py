"""Puerto del repositorio de usuarios (arquitectura hexagonal).

Define el contrato que la capa de aplicación necesita. Las implementaciones
concretas (adaptadores) viven en la capa de infraestructura.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.identity.domain.entities import PasswordResetToken, RefreshSession, User


class UserRepository(ABC):
    """Puerto de persistencia para la entidad Usuario."""

    @abstractmethod
    async def add(self, user: User) -> User:
        """Persiste un nuevo usuario y lo devuelve."""

    @abstractmethod
    async def update(self, user: User) -> User:
        """Actualiza un usuario existente (rol, estado, verificación,
        contraseña) y lo devuelve."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None:
        """Busca un usuario por su id."""

    @abstractmethod
    async def list_all(self, *, limit: int | None = None, offset: int = 0) -> list[User]:
        """Lista usuarios (más recientes primero).

        `limit=None` (default) trae todos: lo usa `AdminService.get_stats`,
        que necesita el total real para las métricas agregadas (P5 de
        `docs/PERFORMANCE_REPORT.md`, fuera de alcance de R2.1). El endpoint
        `GET /admin/users` sí pagina, pasando `limit`/`offset` explícitos.
        """

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        """Busca un usuario por su email (case-insensitive)."""

    @abstractmethod
    async def exists_by_email(self, email: str) -> bool:
        """Indica si ya existe un usuario con ese email."""


class RefreshSessionRepository(ABC):
    """Puerto de persistencia para las sesiones de refresh token (R1.2, ADR-0002)."""

    @abstractmethod
    async def add(self, session: RefreshSession) -> RefreshSession:
        """Persiste una nueva sesión de refresh y la devuelve."""

    @abstractmethod
    async def get_by_jti(self, jti: str) -> RefreshSession | None:
        """Busca una sesión por el `jti` del refresh token."""

    @abstractmethod
    async def revoke(self, jti: str) -> None:
        """Revoca la sesión identificada por `jti` (no-op si no existe o ya lo está)."""

    @abstractmethod
    async def revoke_all_for_user(self, user_id: UUID) -> None:
        """Revoca todas las sesiones activas de un usuario (reuso detectado = posible robo)."""


class PasswordResetTokenRepository(ABC):
    """Puerto de persistencia para los tokens de recuperación de contraseña."""

    @abstractmethod
    async def add(self, token: PasswordResetToken) -> PasswordResetToken:
        """Persiste un nuevo token y lo devuelve."""

    @abstractmethod
    async def get_by_token_hash(self, token_hash: str) -> PasswordResetToken | None:
        """Busca un token por su hash (nunca se busca por el valor en claro)."""

    @abstractmethod
    async def get_latest_unused_for_user(self, user_id: UUID) -> PasswordResetToken | None:
        """Devuelve el token sin usar más reciente del usuario, o None.

        Lo usa `IdentityService` para el rate-limit silencioso de reenvío
        (`PasswordResetToken.created_within`): la comparación de tiempos se
        hace en el dominio, no en la consulta SQL, por el mismo motivo que
        `subscription`/`shift` (SQLite en tests devuelve datetimes "naive")."""

    @abstractmethod
    async def mark_used(self, token_id: UUID) -> None:
        """Marca el token como usado (no-op si no existe o ya lo estaba)."""

    @abstractmethod
    async def invalidate_all_unused_for_user(self, user_id: UUID) -> None:
        """Invalida (marca como usados) todos los tokens vigentes del usuario.

        Se llama tras un reset exitoso: un link de recuperación anterior que
        todavía no se usó no debe seguir sirviendo."""
