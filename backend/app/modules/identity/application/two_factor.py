"""Casos de uso de la verificación en dos pasos de las cuentas admin (ADR-0023).

Sobre puertos: el secreto cifrado y los códigos (`TwoFactorRepository`), los
desafíos del login (`TwoFactorChallengeRepository`) y el cifrado
(`SecretCipher`). No emite tokens: eso lo hace `IdentityService`, que es
quien llama acá.

Fechas en UTC: son de auditoría (cuándo se activó, cuándo se usó un código),
no de negocio.
"""

import logging
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from app.modules.identity.domain.entities import TwoFactorChallenge, User, UserTwoFactor
from app.modules.identity.domain.exceptions import (
    TwoFactorChallengeInvalidError,
    TwoFactorCodeInvalidError,
    TwoFactorEnrollmentNotStartedError,
    TwoFactorNotAllowedError,
    TwoFactorNotConfiguredError,
    TwoFactorNotEnabledError,
    TwoFactorReauthRequiredError,
    TwoFactorTooManyAttemptsError,
)
from app.modules.identity.domain.repositories import (
    TwoFactorChallengeRepository,
    TwoFactorRepository,
)
from app.modules.identity.domain.secret_cipher import SecretCipher
from app.modules.identity.domain.two_factor import (
    ACCOUNT_LOCK_WINDOW,
    ACCOUNT_MAX_FAILED_ATTEMPTS,
    CHALLENGE_MAX_FAILED_ATTEMPTS,
    CHALLENGE_TTL,
    generate_recovery_codes,
    generate_secret,
    hash_challenge_token,
    hash_recovery_code,
    looks_like_totp,
    match_totp,
    provisioning_uri,
)
from app.modules.identity.domain.value_objects import UserRole

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class TwoFactorStatus:
    enabled: bool
    enabled_at: datetime | None
    recovery_codes_left: int


@dataclass(frozen=True)
class TwoFactorEnrollment:
    """Lo que necesita la app autenticadora. El secreto viaja una sola vez,
    en esta respuesta, para cargarlo a mano si el QR no se puede escanear."""

    secret: str
    otpauth_uri: str


@dataclass(frozen=True)
class TwoFactorChallengeIssued:
    """Respuesta del login de un admin con la verificación activa: todavía
    no hay sesión, hay un desafío para canjear con el código."""

    challenge_token: str
    expires_in: int


@dataclass(frozen=True)
class TwoFactorLoginVerified:
    user_id: UUID
    used_recovery_code: bool
    recovery_codes_left: int


class TwoFactorService:
    def __init__(
        self,
        factors: TwoFactorRepository,
        challenges: TwoFactorChallengeRepository,
        cipher: SecretCipher,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._factors = factors
        self._challenges = challenges
        self._cipher = cipher
        self._now = clock

    @staticmethod
    def applies_to(user: User) -> bool:
        """Sólo las cuentas admin. Trabajadores y comercios no cambian."""
        return user.role == UserRole.ADMIN

    async def is_enabled(self, user_id: UUID) -> bool:
        record = await self._factors.get(user_id)
        return record is not None and record.is_enabled

    async def status(self, user: User) -> TwoFactorStatus:
        record = await self._factors.get(user.id)
        if record is None or not record.is_enabled:
            return TwoFactorStatus(enabled=False, enabled_at=None, recovery_codes_left=0)
        return TwoFactorStatus(
            enabled=True,
            enabled_at=record.enabled_at,
            recovery_codes_left=await self._factors.count_unused_recovery_codes(user.id),
        )

    # --- Alta y cambio de celular -----------------------------------------

    async def start_enrollment(
        self, user: User, *, session_verified: bool, current_code: str | None = None
    ) -> TwoFactorEnrollment:
        """Genera un secreto nuevo (pendiente hasta confirmar).

        Primera vez: alcanza con la sesión (es lo único que puede hacer un
        admin sin la verificación). Si ya está activa (cambiar de celular),
        pide una sesión que haya pasado por el código y además un código
        actual (de la app o de recuperación): con sólo un access token
        robado no se puede cambiar el celular de la cuenta."""
        self._require_admin(user)
        self._require_configured()
        record = await self._factors.get(user.id)
        if record is not None and record.is_enabled:
            if not session_verified:
                raise TwoFactorReauthRequiredError()
            if not current_code or not await self._accept_current_code(record, current_code):
                raise TwoFactorCodeInvalidError()
        secret = generate_secret()
        await self._factors.save_pending_secret(user.id, self._cipher.encrypt(secret))
        return TwoFactorEnrollment(secret=secret, otpauth_uri=provisioning_uri(secret, user.email))

    async def confirm_enrollment(
        self, user: User, code: str, *, session_verified: bool
    ) -> list[str]:
        """Confirma el secreto pendiente con un código de la app y devuelve
        los códigos de recuperación nuevos (se muestran una vez; se guardan
        sólo sus hashes). Quien llama cierra las demás sesiones y emite una
        verificada."""
        self._require_admin(user)
        self._require_configured()
        record = await self._factors.get(user.id)
        if record is None or record.pending_secret_encrypted is None:
            raise TwoFactorEnrollmentNotStartedError()
        if record.is_enabled and not session_verified:
            raise TwoFactorReauthRequiredError()
        pending = record.pending_secret_encrypted
        now = self._now()
        step = match_totp(self._decrypt(pending), code, now, last_used_step=None)
        if step is None:
            raise TwoFactorCodeInvalidError()
        if not await self._factors.activate_pending_secret(
            user.id, pending_secret_encrypted=pending, step=step, now=now
        ):
            raise TwoFactorEnrollmentNotStartedError()
        codes = await self._new_recovery_codes(user.id)
        logger.info(
            "2fa.activada",
            extra={"user_id": str(user.id), "cambio_de_celular": record.is_enabled},
        )
        return codes

    async def regenerate_recovery_codes(self, user: User, current_code: str) -> list[str]:
        """Códigos de recuperación nuevos; los anteriores dejan de servir.
        Pide un código actual (de la app o de recuperación)."""
        self._require_admin(user)
        record = await self._factors.get(user.id)
        if record is None or not record.is_enabled:
            raise TwoFactorNotEnabledError()
        self._require_configured()
        if not await self._accept_current_code(record, current_code):
            raise TwoFactorCodeInvalidError()
        codes = await self._new_recovery_codes(user.id)
        logger.info("2fa.codigos_regenerados", extra={"user_id": str(user.id)})
        return codes

    # --- Login ---------------------------------------------------------------

    async def issue_challenge(self, user: User) -> TwoFactorChallengeIssued:
        now = self._now()
        # Los desafíos más viejos que la ventana del tope ya no cuentan: se
        # borran acá en vez de en una tarea aparte (es un admin, son pocos).
        await self._challenges.delete_for_user(user.id, created_before=now - ACCOUNT_LOCK_WINDOW)
        raw = secrets.token_urlsafe(32)
        await self._challenges.add(
            TwoFactorChallenge(
                user_id=user.id,
                token_hash=hash_challenge_token(raw),
                expires_at=now + CHALLENGE_TTL,
            )
        )
        return TwoFactorChallengeIssued(
            challenge_token=raw, expires_in=int(CHALLENGE_TTL.total_seconds())
        )

    async def verify_challenge(self, challenge_token: str, code: str) -> TwoFactorLoginVerified:
        """Canjea el desafío por la identidad verificada si el código es
        válido: uno de la app (ventana ±1 paso, sin repetir) o uno de
        recuperación (un solo uso). Un error suma al desafío y a la cuenta."""
        now = self._now()
        challenge = await self._challenges.get_by_token_hash(hash_challenge_token(challenge_token))
        if challenge is None or not challenge.is_valid(now, CHALLENGE_MAX_FAILED_ATTEMPTS):
            raise TwoFactorChallengeInvalidError()
        failures = await self._challenges.count_failures_since(
            challenge.user_id, now - ACCOUNT_LOCK_WINDOW
        )
        if failures >= ACCOUNT_MAX_FAILED_ATTEMPTS:
            logger.warning("2fa.cuenta_trabada", extra={"user_id": str(challenge.user_id)})
            raise TwoFactorTooManyAttemptsError()
        record = await self._factors.get(challenge.user_id)
        if record is None or not record.is_enabled:
            # Se desactivó entre la contraseña y el código (plan B).
            raise TwoFactorChallengeInvalidError()
        self._require_configured()

        used_recovery = not looks_like_totp(code)
        if not await self._accept_current_code(record, code):
            await self._challenges.record_failure(challenge.id)
            logger.warning("2fa.codigo_invalido", extra={"user_id": str(challenge.user_id)})
            raise TwoFactorCodeInvalidError()
        if not await self._challenges.try_consume(challenge.id, now):
            raise TwoFactorChallengeInvalidError()
        left = await self._factors.count_unused_recovery_codes(challenge.user_id)
        if used_recovery:
            logger.warning(
                "2fa.codigo_de_recuperacion_usado",
                extra={"user_id": str(challenge.user_id), "quedan": left},
            )
        return TwoFactorLoginVerified(
            user_id=challenge.user_id, used_recovery_code=used_recovery, recovery_codes_left=left
        )

    # --- Plan B (soporte, con acceso a la base) ---------------------------------

    async def disable(self, user_id: UUID) -> bool:
        """Borra la verificación, los códigos y los desafíos. Lo usa sólo
        `scripts/disable_two_factor.py`; no hay endpoint para esto."""
        await self._challenges.delete_for_user(user_id)
        removed = await self._factors.delete(user_id)
        logger.warning("2fa.desactivada_por_script", extra={"user_id": str(user_id)})
        return removed

    # --- Internos --------------------------------------------------------------

    async def _accept_current_code(self, record: UserTwoFactor, code: str) -> bool:
        """Valida y gasta un código vigente: de la app (guarda el paso para
        que no se repita) o de recuperación (lo marca usado)."""
        if looks_like_totp(code):
            if record.secret_encrypted is None:
                return False
            step = match_totp(
                self._decrypt(record.secret_encrypted),
                code,
                self._now(),
                last_used_step=record.last_used_step,
            )
            return step is not None and await self._factors.try_use_step(record.user_id, step)
        return await self._factors.consume_recovery_code(
            record.user_id, hash_recovery_code(code), self._now()
        )

    async def _new_recovery_codes(self, user_id: UUID) -> list[str]:
        codes = generate_recovery_codes()
        await self._factors.replace_recovery_codes(
            user_id, [hash_recovery_code(code) for code in codes]
        )
        return codes

    def _decrypt(self, ciphertext: str) -> str:
        return self._cipher.decrypt(ciphertext)

    def _require_configured(self) -> None:
        if not self._cipher.is_configured:
            raise TwoFactorNotConfiguredError()

    def _require_admin(self, user: User) -> None:
        if not self.applies_to(user):
            raise TwoFactorNotAllowedError()
