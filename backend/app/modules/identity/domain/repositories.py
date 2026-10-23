"""Puerto del repositorio de usuarios (arquitectura hexagonal).

Define el contrato que la capa de aplicación necesita. Las implementaciones
concretas (adaptadores) viven en la capa de infraestructura.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.modules.identity.domain.entities import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshSession,
    TermsAcceptance,
    TwoFactorChallenge,
    User,
    UserTwoFactor,
)
from app.modules.identity.domain.value_objects import UserRole, UserStatus


@dataclass
class UserCounts:
    """Conteos agregados de `users`, para el panel de admin.

    Existe para que el repositorio los calcule con `GROUP BY`/`SUM` en SQL
    (PRODUCTION_HARDENING.md, P5 de la auditoría) en vez de traer toda la
    tabla y contar en Python."""

    total: int
    workers: int
    employers: int
    admins: int
    active: int
    suspended: int
    verified: int


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
    async def list_all(
        self,
        *,
        limit: int | None = None,
        offset: int = 0,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        verified: bool | None = None,
    ) -> list[User]:
        """Lista usuarios (más recientes primero).

        Filtros opcionales del buscador de "Personas" (panel de admin):
        `search` busca en nombre y email sin distinguir mayúsculas; `role`,
        `status` y `verified` filtran por igualdad.

        `limit=None` (default) trae todos: lo usa `AdminService.get_stats`,
        que necesita el total real para las métricas agregadas (P5 de
        `docs/audits/PERFORMANCE_REPORT.md`, fuera de alcance de R2.1). El endpoint
        `GET /admin/users` sí pagina, pasando `limit`/`offset` explícitos.
        """

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        """Busca un usuario por su email (case-insensitive)."""

    @abstractmethod
    async def exists_by_email(self, email: str) -> bool:
        """Indica si ya existe un usuario con ese email."""

    @abstractmethod
    async def count_stats(self, *, exclude_emails: frozenset[str] = frozenset()) -> UserCounts:
        """Conteos agregados por rol/estado/verificación, calculados en SQL.

        `exclude_emails` saca cuentas sintéticas (invitado/prueba) del conteo
        — sin esto, el panel de admin cuenta cuentas que no son usuarios
        reales como si lo fueran (auditoría 2026-08-15, F2)."""


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

    @abstractmethod
    async def delete_expired_before(self, cutoff: datetime) -> int:
        """Borra las sesiones cuyo `expires_at` es anterior a `cutoff` y
        devuelve cuántas borró (retención: un refresh vencido ya no sirve,
        su JWT también venció)."""


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


class EmailVerificationTokenRepository(ABC):
    """Puerto de persistencia para los tokens de verificación de email
    (PRODUCTION_HARDENING.md). Mismo contrato que
    `PasswordResetTokenRepository`, para el flujo de confirmar la cuenta."""

    @abstractmethod
    async def add(self, token: EmailVerificationToken) -> EmailVerificationToken:
        """Persiste un nuevo token y lo devuelve."""

    @abstractmethod
    async def get_by_token_hash(self, token_hash: str) -> EmailVerificationToken | None:
        """Busca un token por su hash (nunca se busca por el valor en claro)."""

    @abstractmethod
    async def get_latest_unused_for_user(self, user_id: UUID) -> EmailVerificationToken | None:
        """Devuelve el token sin usar más reciente del usuario, o None
        (rate-limit silencioso de reenvío, mismo criterio que password reset)."""

    @abstractmethod
    async def mark_used(self, token_id: UUID) -> None:
        """Marca el token como usado (no-op si no existe o ya lo estaba)."""


class TermsAcceptanceRepository(ABC):
    """Puerto de persistencia de las aceptaciones de términos. Sólo agrega y
    lee: una constancia no se modifica."""

    @abstractmethod
    async def add(self, acceptance: TermsAcceptance) -> TermsAcceptance:
        """Guarda una aceptación y la devuelve con `accepted_at` resuelto."""

    @abstractmethod
    async def list_for_user(self, user_id: UUID) -> list[TermsAcceptance]:
        """Aceptaciones del usuario, la más reciente primero."""


class TwoFactorRepository(ABC):
    """Puerto de la verificación en dos pasos de cada cuenta (ADR-0023): el
    secreto TOTP cifrado y los códigos de recuperación (sólo sus hashes).

    Las operaciones de "un solo uso" son condicionales y atómicas en la base
    (`try_use_step`, `consume_recovery_code`): dos pedidos simultáneos con el
    mismo código no pueden pasar los dos."""

    @abstractmethod
    async def get(self, user_id: UUID) -> UserTwoFactor | None:
        """La verificación de la cuenta, o None si nunca empezó el alta."""

    @abstractmethod
    async def save_pending_secret(self, user_id: UUID, secret_encrypted: str) -> None:
        """Guarda un secreto nuevo sin confirmar (alta o cambio de celular).
        No toca el secreto vigente: ése sigue sirviendo hasta confirmar."""

    @abstractmethod
    async def activate_pending_secret(
        self, user_id: UUID, *, pending_secret_encrypted: str, step: int, now: datetime
    ) -> bool:
        """Pasa el secreto pendiente a vigente (si sigue siendo
        `pending_secret_encrypted`: otro alta en paralelo no se pisa), anota
        `step` como último paso usado y, si era la primera vez, `enabled_at`.
        Devuelve False si el pendiente ya no era ése."""

    @abstractmethod
    async def try_use_step(self, user_id: UUID, step: int) -> bool:
        """Anti-replay: guarda `step` como último paso usado sólo si es
        posterior al guardado. False si ya se usó (o uno posterior)."""

    @abstractmethod
    async def replace_recovery_codes(self, user_id: UUID, code_hashes: list[str]) -> None:
        """Borra los códigos de recuperación anteriores y guarda estos."""

    @abstractmethod
    async def consume_recovery_code(self, user_id: UUID, code_hash: str, now: datetime) -> bool:
        """Marca como usado el código con ese hash, si existe y no se usó."""

    @abstractmethod
    async def count_unused_recovery_codes(self, user_id: UUID) -> int:
        """Cuántos códigos de recuperación le quedan."""

    @abstractmethod
    async def delete(self, user_id: UUID) -> bool:
        """Borra la verificación y los códigos (plan B de soporte, ver
        `scripts/disable_two_factor.py`). False si no había nada."""


class TwoFactorChallengeRepository(ABC):
    """Puerto de los desafíos del login en dos pasos (ADR-0023)."""

    @abstractmethod
    async def add(self, challenge: TwoFactorChallenge) -> TwoFactorChallenge:
        """Guarda un desafío nuevo."""

    @abstractmethod
    async def get_by_token_hash(self, token_hash: str) -> TwoFactorChallenge | None:
        """Busca por el hash del token (nunca por el valor en claro)."""

    @abstractmethod
    async def record_failure(self, challenge_id: UUID) -> None:
        """Suma un código equivocado al desafío."""

    @abstractmethod
    async def try_consume(self, challenge_id: UUID, now: datetime) -> bool:
        """Lo marca como usado si todavía no lo estaba (un solo uso)."""

    @abstractmethod
    async def count_failures_since(self, user_id: UUID, since: datetime) -> int:
        """Códigos equivocados de la cuenta en desafíos creados desde `since`
        (tope por cuenta, además del de cada desafío)."""

    @abstractmethod
    async def delete_for_user(
        self, user_id: UUID, *, created_before: datetime | None = None
    ) -> int:
        """Borra los desafíos de la cuenta (todos, o los creados antes de
        `created_before`: ya no cuentan para el tope). Devuelve cuántos."""
