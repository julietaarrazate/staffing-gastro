"""Adaptador de persistencia: implementación SQLAlchemy de los repos de identity."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.domain.entities import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshSession,
    User,
)
from app.modules.identity.domain.repositories import (
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RefreshSessionRepository,
    UserCounts,
    UserRepository,
)
from app.modules.identity.domain.value_objects import UserRole, UserStatus
from app.modules.identity.infrastructure.models import (
    EmailVerificationTokenModel,
    PasswordResetTokenModel,
    RefreshSessionModel,
    UserModel,
)


def _to_entity(model: UserModel) -> User:
    """Mapea un modelo ORM a la entidad de dominio."""
    return User(
        id=model.id,
        email=model.email,
        hashed_password=model.hashed_password,
        full_name=model.full_name,
        role=UserRole(model.role),
        status=UserStatus(model.status),
        is_verified=model.is_verified,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class SqlAlchemyUserRepository(UserRepository):
    """Implementación del puerto UserRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            email=user.email,
            hashed_password=user.hashed_password,
            full_name=user.full_name,
            role=user.role.value,
            status=user.status.value,
            is_verified=user.is_verified,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def get_by_id(self, user_id: UUID) -> User | None:
        model = await self._session.get(UserModel, user_id)
        return _to_entity(model) if model else None

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(UserModel).where(func.lower(UserModel.email) == email.lower())
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def exists_by_email(self, email: str) -> bool:
        stmt = select(UserModel.id).where(func.lower(UserModel.email) == email.lower())
        result = await self._session.execute(stmt)
        return result.first() is not None

    async def update(self, user: User) -> User:
        model = await self._session.get(UserModel, user.id)
        model.role = user.role.value
        model.status = user.status.value
        model.is_verified = user.is_verified
        model.full_name = user.full_name
        # hashed_password: sólo lo cambia el flujo de reset de contraseña
        # (`IdentityService.reset_password`); el resto de los llamadores
        # reasignan el mismo hash que ya tenía la entidad, así que incluirlo
        # acá es un no-op para ellos.
        model.hashed_password = user.hashed_password
        await self._session.commit()
        await self._session.refresh(model)
        return _to_entity(model)

    async def list_all(self, *, limit: int | None = None, offset: int = 0) -> list[User]:
        stmt = select(UserModel).order_by(desc(UserModel.created_at)).offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await self._session.execute(stmt)
        return [_to_entity(model) for model in result.scalars().all()]

    async def count_stats(self, *, exclude_emails: frozenset[str] = frozenset()) -> UserCounts:
        # Una sola query con SUM/CASE en vez de traer toda la tabla y contar
        # en Python (P5, PRODUCTION_HARDENING.md) — portable SQLite/Postgres.
        stmt = select(
            func.count().label("total"),
            func.sum(case((UserModel.role == UserRole.WORKER.value, 1), else_=0)).label(
                "workers"
            ),
            func.sum(case((UserModel.role == UserRole.EMPLOYER.value, 1), else_=0)).label(
                "employers"
            ),
            func.sum(case((UserModel.role == UserRole.ADMIN.value, 1), else_=0)).label(
                "admins"
            ),
            func.sum(case((UserModel.status == UserStatus.ACTIVE.value, 1), else_=0)).label(
                "active"
            ),
            func.sum(
                case((UserModel.status == UserStatus.SUSPENDED.value, 1), else_=0)
            ).label("suspended"),
            func.sum(case((UserModel.is_verified.is_(True), 1), else_=0)).label("verified"),
        )
        if exclude_emails:
            stmt = stmt.where(UserModel.email.notin_(exclude_emails))
        row = (await self._session.execute(stmt)).one()
        return UserCounts(
            total=row.total or 0,
            workers=row.workers or 0,
            employers=row.employers or 0,
            admins=row.admins or 0,
            active=row.active or 0,
            suspended=row.suspended or 0,
            verified=row.verified or 0,
        )


def _session_to_entity(model: RefreshSessionModel) -> RefreshSession:
    """Mapea un modelo ORM de sesión de refresh a la entidad de dominio."""
    return RefreshSession(
        id=model.id,
        user_id=model.user_id,
        jti=model.jti,
        expires_at=model.expires_at,
        revoked_at=model.revoked_at,
        created_at=model.created_at,
    )


class SqlAlchemyRefreshSessionRepository(RefreshSessionRepository):
    """Implementación del puerto RefreshSessionRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, session: RefreshSession) -> RefreshSession:
        model = RefreshSessionModel(
            id=session.id,
            user_id=session.user_id,
            jti=session.jti,
            expires_at=session.expires_at,
            revoked_at=session.revoked_at,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _session_to_entity(model)

    async def get_by_jti(self, jti: str) -> RefreshSession | None:
        stmt = select(RefreshSessionModel).where(RefreshSessionModel.jti == jti)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _session_to_entity(model) if model else None

    async def revoke(self, jti: str) -> None:
        stmt = select(RefreshSessionModel).where(RefreshSessionModel.jti == jti)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is not None and model.revoked_at is None:
            model.revoked_at = datetime.now(timezone.utc)
            await self._session.commit()

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        stmt = select(RefreshSessionModel).where(
            RefreshSessionModel.user_id == user_id,
            RefreshSessionModel.revoked_at.is_(None),
        )
        result = await self._session.execute(stmt)
        now = datetime.now(timezone.utc)
        for model in result.scalars().all():
            model.revoked_at = now
        await self._session.commit()


def _reset_token_to_entity(model: PasswordResetTokenModel) -> PasswordResetToken:
    """Mapea un modelo ORM de token de reset a la entidad de dominio."""
    return PasswordResetToken(
        id=model.id,
        user_id=model.user_id,
        token_hash=model.token_hash,
        expires_at=model.expires_at,
        used_at=model.used_at,
        created_at=model.created_at,
    )


class SqlAlchemyPasswordResetTokenRepository(PasswordResetTokenRepository):
    """Implementación del puerto PasswordResetTokenRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: PasswordResetToken) -> PasswordResetToken:
        model = PasswordResetTokenModel(
            id=token.id,
            user_id=token.user_id,
            token_hash=token.token_hash,
            expires_at=token.expires_at,
            used_at=token.used_at,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _reset_token_to_entity(model)

    async def get_by_token_hash(self, token_hash: str) -> PasswordResetToken | None:
        stmt = select(PasswordResetTokenModel).where(
            PasswordResetTokenModel.token_hash == token_hash
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _reset_token_to_entity(model) if model else None

    async def get_latest_unused_for_user(self, user_id: UUID) -> PasswordResetToken | None:
        stmt = (
            select(PasswordResetTokenModel)
            .where(
                PasswordResetTokenModel.user_id == user_id,
                PasswordResetTokenModel.used_at.is_(None),
            )
            .order_by(desc(PasswordResetTokenModel.created_at))
            .limit(1)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _reset_token_to_entity(model) if model else None

    async def mark_used(self, token_id: UUID) -> None:
        model = await self._session.get(PasswordResetTokenModel, token_id)
        if model is not None and model.used_at is None:
            model.used_at = datetime.now(timezone.utc)
            await self._session.commit()

    async def invalidate_all_unused_for_user(self, user_id: UUID) -> None:
        stmt = select(PasswordResetTokenModel).where(
            PasswordResetTokenModel.user_id == user_id,
            PasswordResetTokenModel.used_at.is_(None),
        )
        result = await self._session.execute(stmt)
        now = datetime.now(timezone.utc)
        for model in result.scalars().all():
            model.used_at = now
        await self._session.commit()


def _verification_token_to_entity(
    model: EmailVerificationTokenModel,
) -> EmailVerificationToken:
    return EmailVerificationToken(
        id=model.id,
        user_id=model.user_id,
        token_hash=model.token_hash,
        expires_at=model.expires_at,
        used_at=model.used_at,
        created_at=model.created_at,
    )


class SqlAlchemyEmailVerificationTokenRepository(EmailVerificationTokenRepository):
    """Implementación del puerto EmailVerificationTokenRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: EmailVerificationToken) -> EmailVerificationToken:
        model = EmailVerificationTokenModel(
            id=token.id,
            user_id=token.user_id,
            token_hash=token.token_hash,
            expires_at=token.expires_at,
            used_at=token.used_at,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _verification_token_to_entity(model)

    async def get_by_token_hash(self, token_hash: str) -> EmailVerificationToken | None:
        stmt = select(EmailVerificationTokenModel).where(
            EmailVerificationTokenModel.token_hash == token_hash
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _verification_token_to_entity(model) if model else None

    async def get_latest_unused_for_user(
        self, user_id: UUID
    ) -> EmailVerificationToken | None:
        stmt = (
            select(EmailVerificationTokenModel)
            .where(
                EmailVerificationTokenModel.user_id == user_id,
                EmailVerificationTokenModel.used_at.is_(None),
            )
            .order_by(desc(EmailVerificationTokenModel.created_at))
            .limit(1)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _verification_token_to_entity(model) if model else None

    async def mark_used(self, token_id: UUID) -> None:
        model = await self._session.get(EmailVerificationTokenModel, token_id)
        if model is not None and model.used_at is None:
            model.used_at = datetime.now(timezone.utc)
            await self._session.commit()
