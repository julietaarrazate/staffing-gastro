"""Entidad de dominio Usuario.

Representa al usuario de forma pura, sin acoplarse a SQLAlchemy ni a FastAPI.
La persistencia se hace mediante un mapeo en la capa de infraestructura.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.dt import naive as _naive
from app.modules.identity.domain.value_objects import UserRole, UserStatus


@dataclass
class User:
    """Raíz de agregado Usuario."""

    email: str
    hashed_password: str
    role: UserRole
    full_name: str
    id: UUID = field(default_factory=uuid4)
    status: UserStatus = UserStatus.ACTIVE
    is_verified: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    def verify(self) -> None:
        """Marca el usuario como verificado (estado de verificación del spec)."""
        self.is_verified = True

    def suspend(self) -> None:
        self.status = UserStatus.SUSPENDED

    def activate(self) -> None:
        self.status = UserStatus.ACTIVE

    def promote_to_admin(self) -> None:
        self.role = UserRole.ADMIN


@dataclass
class RefreshSession:
    """Sesión de refresh token: registro server-side que permite revocación.

    Cada refresh token emitido queda identificado por su claim `jti` (único).
    La sesión se revoca al rotar (usarse en `/auth/refresh`), al hacer logout,
    o en bloque si se detecta reuso de un token ya revocado (posible robo).
    """

    user_id: UUID
    jti: str
    expires_at: datetime
    id: UUID = field(default_factory=uuid4)
    revoked_at: datetime | None = None
    created_at: datetime | None = None

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def revoke(self) -> None:
        """Marca la sesión como revocada (idempotente)."""
        if self.revoked_at is None:
            self.revoked_at = datetime.now(timezone.utc)


@dataclass
class PasswordResetToken:
    """Token de un solo uso para recuperación de contraseña.

    Nunca se persiste el token en claro: `token_hash` guarda el sha256 del
    valor que viaja en el link del email (ver `IdentityService`). Vence a la
    hora de emitido y queda inutilizado (`used_at`) al usarse una vez, o al
    invalidarse en bloque cuando otro reset se completa antes (mismo criterio
    de "un solo uso" que `RefreshSession`, pero sin necesitar revocación
    explícita por logout).
    """

    user_id: UUID
    token_hash: str
    expires_at: datetime
    id: UUID = field(default_factory=uuid4)
    used_at: datetime | None = None
    created_at: datetime | None = None

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    def is_expired(self, now: datetime) -> bool:
        return _naive(now) >= _naive(self.expires_at)

    def is_valid(self, now: datetime) -> bool:
        """True si todavía se puede usar para restablecer la contraseña."""
        return not self.is_used and not self.is_expired(now)

    def mark_used(self, now: datetime) -> None:
        """Marca el token como usado (idempotente)."""
        if self.used_at is None:
            self.used_at = now

    def created_within(self, window: timedelta, now: datetime) -> bool:
        """True si se creó hace menos de `window` (rate-limit de reenvío)."""
        if self.created_at is None:
            return False
        return (_naive(now) - _naive(self.created_at)) < window


@dataclass
class EmailVerificationToken:
    """Token de un solo uso para confirmar la propiedad de un email
    (PRODUCTION_HARDENING.md). Mismo diseño que `PasswordResetToken`: sólo
    se persiste el hash, vence, se usa una vez, y admite rate-limit de
    reenvío silencioso."""

    user_id: UUID
    token_hash: str
    expires_at: datetime
    id: UUID = field(default_factory=uuid4)
    used_at: datetime | None = None
    created_at: datetime | None = None

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    def is_expired(self, now: datetime) -> bool:
        return _naive(now) >= _naive(self.expires_at)

    def is_valid(self, now: datetime) -> bool:
        return not self.is_used and not self.is_expired(now)

    def mark_used(self, now: datetime) -> None:
        if self.used_at is None:
            self.used_at = now

    def created_within(self, window: timedelta, now: datetime) -> bool:
        if self.created_at is None:
            return False
        return (_naive(now) - _naive(self.created_at)) < window
