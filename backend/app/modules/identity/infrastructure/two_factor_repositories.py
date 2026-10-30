"""Adaptadores SQLAlchemy de la verificación en dos pasos (ADR-0023).

Lo de un solo uso (paso TOTP, código de recuperación, desafío) es un UPDATE
condicional: la base decide quién gana si llegan dos pedidos a la vez.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.domain.entities import TwoFactorChallenge, UserTwoFactor
from app.modules.identity.domain.repositories import (
    TwoFactorChallengeRepository,
    TwoFactorRepository,
)
from app.modules.identity.infrastructure.models import (
    TwoFactorChallengeModel,
    TwoFactorRecoveryCodeModel,
    UserTwoFactorModel,
)


def _factor_to_entity(model: UserTwoFactorModel) -> UserTwoFactor:
    return UserTwoFactor(
        user_id=model.user_id,
        secret_encrypted=model.secret_encrypted,
        pending_secret_encrypted=model.pending_secret_encrypted,
        enabled_at=model.enabled_at,
        last_used_step=model.last_used_step,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _challenge_to_entity(model: TwoFactorChallengeModel) -> TwoFactorChallenge:
    return TwoFactorChallenge(
        id=model.id,
        user_id=model.user_id,
        token_hash=model.token_hash,
        expires_at=model.expires_at,
        used_at=model.used_at,
        failed_attempts=model.failed_attempts,
        created_at=model.created_at,
    )


class SqlAlchemyTwoFactorRepository(TwoFactorRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID) -> UserTwoFactor | None:
        model = await self._session.get(UserTwoFactorModel, user_id, populate_existing=True)
        return _factor_to_entity(model) if model else None

    async def save_pending_secret(self, user_id: UUID, secret_encrypted: str) -> None:
        model = await self._session.get(UserTwoFactorModel, user_id)
        if model is None:
            self._session.add(
                UserTwoFactorModel(user_id=user_id, pending_secret_encrypted=secret_encrypted)
            )
        else:
            model.pending_secret_encrypted = secret_encrypted
        await self._session.commit()

    async def activate_pending_secret(
        self, user_id: UUID, *, pending_secret_encrypted: str, step: int, now: datetime
    ) -> bool:
        stmt = (
            update(UserTwoFactorModel)
            .where(
                UserTwoFactorModel.user_id == user_id,
                UserTwoFactorModel.pending_secret_encrypted == pending_secret_encrypted,
            )
            .values(
                secret_encrypted=pending_secret_encrypted,
                pending_secret_encrypted=None,
                last_used_step=step,
                enabled_at=func.coalesce(UserTwoFactorModel.enabled_at, now),
                updated_at=now,
            )
            .execution_options(synchronize_session=False)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount == 1

    async def try_use_step(self, user_id: UUID, step: int) -> bool:
        stmt = (
            update(UserTwoFactorModel)
            .where(
                UserTwoFactorModel.user_id == user_id,
                or_(
                    UserTwoFactorModel.last_used_step.is_(None),
                    UserTwoFactorModel.last_used_step < step,
                ),
            )
            .values(last_used_step=step)
            .execution_options(synchronize_session=False)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount == 1

    async def replace_recovery_codes(self, user_id: UUID, code_hashes: list[str]) -> None:
        await self._session.execute(
            delete(TwoFactorRecoveryCodeModel).where(
                TwoFactorRecoveryCodeModel.user_id == user_id
            )
        )
        self._session.add_all(
            TwoFactorRecoveryCodeModel(user_id=user_id, code_hash=code_hash)
            for code_hash in code_hashes
        )
        await self._session.commit()

    async def consume_recovery_code(self, user_id: UUID, code_hash: str, now: datetime) -> bool:
        # Un solo código por UPDATE: si por azar hubiera dos iguales, se
        # gasta uno (el de menor id), no los dos.
        target = (
            select(TwoFactorRecoveryCodeModel.id)
            .where(
                TwoFactorRecoveryCodeModel.user_id == user_id,
                TwoFactorRecoveryCodeModel.code_hash == code_hash,
                TwoFactorRecoveryCodeModel.used_at.is_(None),
            )
            .order_by(TwoFactorRecoveryCodeModel.id)
            .limit(1)
            .scalar_subquery()
        )
        stmt = (
            update(TwoFactorRecoveryCodeModel)
            .where(
                TwoFactorRecoveryCodeModel.id == target,
                TwoFactorRecoveryCodeModel.used_at.is_(None),
            )
            .values(used_at=now)
            .execution_options(synchronize_session=False)
        )
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount == 1

    async def count_unused_recovery_codes(self, user_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(TwoFactorRecoveryCodeModel)
            .where(
                TwoFactorRecoveryCodeModel.user_id == user_id,
                TwoFactorRecoveryCodeModel.used_at.is_(None),
            )
        )
        return int(result.scalar_one())

    async def delete(self, user_id: UUID) -> bool:
        await self._session.execute(
            delete(TwoFactorRecoveryCodeModel).where(
                TwoFactorRecoveryCodeModel.user_id == user_id
            )
        )
        result = await self._session.execute(
            delete(UserTwoFactorModel).where(UserTwoFactorModel.user_id == user_id)
        )
        await self._session.commit()
        return (result.rowcount or 0) > 0


class SqlAlchemyTwoFactorChallengeRepository(TwoFactorChallengeRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, challenge: TwoFactorChallenge) -> TwoFactorChallenge:
        model = TwoFactorChallengeModel(
            id=challenge.id,
            user_id=challenge.user_id,
            token_hash=challenge.token_hash,
            expires_at=challenge.expires_at,
            used_at=challenge.used_at,
            failed_attempts=challenge.failed_attempts,
            # Desde el reloj de quien llama (no `now()` de la base), así la
            # ventana del tope por cuenta se compara contra la misma hora.
            created_at=challenge.created_at or datetime.now(timezone.utc),
        )
        self._session.add(model)
        await self._session.commit()
        return _challenge_to_entity(model)

    async def get_by_token_hash(self, token_hash: str) -> TwoFactorChallenge | None:
        result = await self._session.execute(
            select(TwoFactorChallengeModel)
            .where(TwoFactorChallengeModel.token_hash == token_hash)
            .execution_options(populate_existing=True)
        )
        model = result.scalar_one_or_none()
        return _challenge_to_entity(model) if model else None

    async def record_failure(self, challenge_id: UUID) -> None:
        await self._session.execute(
            update(TwoFactorChallengeModel)
            .where(TwoFactorChallengeModel.id == challenge_id)
            .values(failed_attempts=TwoFactorChallengeModel.failed_attempts + 1)
            .execution_options(synchronize_session=False)
        )
        await self._session.commit()

    async def try_consume(self, challenge_id: UUID, now: datetime) -> bool:
        result = await self._session.execute(
            update(TwoFactorChallengeModel)
            .where(
                TwoFactorChallengeModel.id == challenge_id,
                TwoFactorChallengeModel.used_at.is_(None),
            )
            .values(used_at=now)
            .execution_options(synchronize_session=False)
        )
        await self._session.commit()
        return result.rowcount == 1

    async def count_failures_since(self, user_id: UUID, since: datetime) -> int:
        result = await self._session.execute(
            select(func.coalesce(func.sum(TwoFactorChallengeModel.failed_attempts), 0)).where(
                TwoFactorChallengeModel.user_id == user_id,
                TwoFactorChallengeModel.created_at >= since,
            )
        )
        return int(result.scalar_one())

    async def delete_for_user(
        self, user_id: UUID, *, created_before: datetime | None = None
    ) -> int:
        stmt = delete(TwoFactorChallengeModel).where(TwoFactorChallengeModel.user_id == user_id)
        if created_before is not None:
            stmt = stmt.where(TwoFactorChallengeModel.created_at < created_before)
        result = await self._session.execute(stmt)
        await self._session.commit()
        return result.rowcount or 0
