"""Entidad de dominio Usuario.

Representa al usuario de forma pura, sin acoplarse a SQLAlchemy ni a FastAPI.
La persistencia se hace mediante un mapeo en la capa de infraestructura.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from app.core.dt import naive as _naive
from app.modules.identity.domain.value_objects import (
    TermsAcceptanceChannel,
    UserRole,
    UserStatus,
)


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
    # Fecha de nacimiento declarada en el alta (U101). Privada: sólo sirve
    # para no dejar entrar a menores de 18; no se muestra a nadie. Las
    # cuentas creadas antes de 2026-11 y las internas (invitadas, seed) no
    # la tienen.
    birth_date: date | None = None
    # De qué enlace llegó (`?ref=` o `utm_*`; «directo» si no traía nada),
    # ver `domain/origen_alta.py`. Lo fija el alta pública y no cambia. Nulo
    # en las cuentas anteriores a la migración 0057 y en las internas.
    signup_origin: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Cómo estaba guardado cuando se leyó: lo arma el repositorio, que al
    # guardar escribe sólo lo que el caso de uso cambió desde entonces.
    # Cambiarse el nombre no pisa una suspensión que la admin guardó en el
    # medio, ni la suspensión una contraseña nueva (CON-13). El dominio sólo
    # lo transporta.
    persisted_state: dict[str, Any] | None = field(
        default=None, compare=False, repr=False
    )

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


# Ventana de gracia de un refresh token recién rotado (ADR-0002, actualización
# 2026-11-19). Si vuelve a llegar dentro de este plazo no es robo: es la
# segunda pestaña que salió con la misma cookie, o el reintento del celular
# que no llegó a recibir la respuesta. Sirve UNA vez: se le da un par nuevo y
# se revoca la sucesora que el cliente no recibió, sin cortar las demás
# sesiones. Pasado el plazo, o usada ya, el reuso vuelve a cerrar todo.
REFRESH_ROTATION_GRACE = timedelta(seconds=30)


@dataclass
class RefreshSession:
    """Sesión de refresh token: registro server-side que permite revocación.

    Cada refresh token emitido queda identificado por su claim `jti` (único).
    La sesión se revoca al rotar (usarse en `/auth/refresh`), al hacer logout,
    o en bloque si se detecta reuso de un token ya revocado (posible robo).

    `rotated_at` dice cuándo se revocó POR ROTACIÓN (y no por cierre de
    sesión, contraseña nueva, suspensión o robo) mientras la ventana de gracia
    siga sin usar: usarla, o una revocación en bloque dentro del plazo, lo
    borra. `replaced_by` es el `jti` de la sesión que la reemplazó.
    """

    user_id: UUID
    jti: str
    expires_at: datetime
    id: UUID = field(default_factory=uuid4)
    revoked_at: datetime | None = None
    created_at: datetime | None = None
    rotated_at: datetime | None = None
    replaced_by: str | None = None

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def revoke(self) -> None:
        """Marca la sesión como revocada (idempotente)."""
        if self.revoked_at is None:
            self.revoked_at = datetime.now(timezone.utc)

    def rotated_within_grace(self, now: datetime) -> bool:
        """True si se rotó hace `REFRESH_ROTATION_GRACE` o menos, tiene
        sucesora y la ventana sigue sin usar: volver a usarla no es robo
        (todavía falta que la sucesora siga viva, ver
        `RefreshSessionRepository.use_rotation_grace`)."""
        if self.rotated_at is None or self.replaced_by is None:
            return False
        return _naive(now) - _naive(self.rotated_at) <= REFRESH_ROTATION_GRACE


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


@dataclass
class TermsAcceptance:
    """Constancia de que una persona aceptó los términos y la política de
    privacidad: quién, qué versión, desde dónde y cuándo.

    Antes del 2026-09-26 el checkbox del registro sólo trababa el botón y no
    quedaba nada guardado: si alguien discutía haber aceptado, no había cómo
    mostrarlo. Es un registro que sólo crece (nunca se edita ni se borra una
    fila): cuando cambie `LEGAL_TERMS_VERSION`, la nueva aceptación es otra
    fila y la anterior queda como historia."""

    user_id: UUID
    version: str
    channel: TermsAcceptanceChannel
    id: UUID = field(default_factory=uuid4)
    accepted_at: datetime | None = None


@dataclass
class UserTwoFactor:
    """Verificación en dos pasos de una cuenta admin (ADR-0023).

    `secret_encrypted` es el secreto TOTP vigente, cifrado con la clave de
    `TWO_FACTOR_ENCRYPTION_KEY` (nunca se guarda en claro). Mientras se da de
    alta (o se cambia de celular) el secreto nuevo espera en
    `pending_secret_encrypted` hasta que se confirma con un código: así,
    empezar el cambio y no terminarlo no deja a nadie afuera.

    `last_used_step` es el último paso de 30 s aceptado (anti-replay): un
    código no sirve dos veces. Fechas en UTC (auditoría)."""

    user_id: UUID
    secret_encrypted: str | None = None
    pending_secret_encrypted: str | None = None
    enabled_at: datetime | None = None
    last_used_step: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def is_enabled(self) -> bool:
        return self.enabled_at is not None and self.secret_encrypted is not None


@dataclass
class TwoFactorChallenge:
    """Paso intermedio del login de un admin con la verificación activada:
    la contraseña (o Google) ya se validó y falta el código. Se guarda sólo
    el hash del token (como los de recuperación de contraseña), vence a los
    5 minutos, sirve una vez y se quema tras `CHALLENGE_MAX_FAILED_ATTEMPTS`
    errores."""

    user_id: UUID
    token_hash: str
    expires_at: datetime
    id: UUID = field(default_factory=uuid4)
    used_at: datetime | None = None
    failed_attempts: int = 0
    created_at: datetime | None = None

    def is_valid(self, now: datetime, max_failed_attempts: int) -> bool:
        return (
            self.used_at is None
            and _naive(now) < _naive(self.expires_at)
            and self.failed_attempts < max_failed_attempts
        )
