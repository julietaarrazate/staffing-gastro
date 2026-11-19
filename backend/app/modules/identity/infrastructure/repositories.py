"""Adaptador de persistencia: implementación SQLAlchemy de los repos de identity."""

from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, case, delete, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.row_state import changed_since_read

from app.modules.identity.domain.entities import (
    REFRESH_ROTATION_GRACE,
    EmailVerificationToken,
    PasswordResetToken,
    RefreshSession,
    TermsAcceptance,
    User,
)
from app.modules.identity.domain.repositories import (
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    RefreshSessionRepository,
    SignupOriginCount,
    TermsAcceptanceRepository,
    UserCounts,
    UserRepository,
)
from app.modules.identity.domain.value_objects import (
    TermsAcceptanceChannel,
    UserRole,
    UserStatus,
)
from app.modules.identity.infrastructure.models import (
    EmailVerificationTokenModel,
    PasswordResetTokenModel,
    RefreshSessionModel,
    TermsAcceptanceModel,
    UserModel,
)


def _user_values(user: User) -> dict:
    """Las columnas que escribe `update` (el resto no cambia después del alta)."""
    return {
        "role": user.role.value,
        "status": user.status.value,
        "is_verified": user.is_verified,
        "full_name": user.full_name,
        "hashed_password": user.hashed_password,
    }


def _to_entity(model: UserModel) -> User:
    """Mapea un modelo ORM a la entidad de dominio."""
    user = User(
        id=model.id,
        email=model.email,
        hashed_password=model.hashed_password,
        full_name=model.full_name,
        role=UserRole(model.role),
        status=UserStatus(model.status),
        is_verified=model.is_verified,
        birth_date=model.birth_date,
        signup_origin=model.signup_origin,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )
    user.persisted_state = _user_values(user)
    return user


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
            birth_date=user.birth_date,
            signup_origin=user.signup_origin,
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
        """Escribe sólo las columnas que el caso de uso cambió desde que leyó
        al usuario (`User.persisted_state`): `UPDATE users SET <esas> WHERE
        id = …`. Antes reescribía rol, estado, verificado, nombre y
        contraseña desde la copia leída, y cambiarse el nombre mientras la
        admin suspendía la cuenta deshacía la suspensión (CON-13). Cada caso
        de uso escribe columnas distintas (nombre, contraseña, estado, rol,
        verificado), así que no hace falta versión: lo de los dos queda.
        Devuelve el usuario como quedó en la base."""
        changes = changed_since_read(user.persisted_state, _user_values(user))
        if changes:
            await self._session.execute(
                update(UserModel)
                .where(UserModel.id == user.id)
                .values(**changes)
                .execution_options(synchronize_session=False)
            )
        await self._session.commit()
        # Lo que escribió pasa a ser lo leído: si el caso de uso vuelve a
        # guardar la misma entidad, no reescribe estos cambios.
        user.persisted_state = _user_values(user)
        model = await self._session.get(UserModel, user.id, populate_existing=True)
        if model is None:
            raise ValueError("El usuario no existe")
        return _to_entity(model)

    async def list_all(
        self,
        *,
        limit: int | None = None,
        offset: int = 0,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        verified: bool | None = None,
        also_user_ids: Sequence[UUID] = (),
    ) -> list[User]:
        stmt = select(UserModel).order_by(desc(UserModel.created_at)).offset(offset)
        if search:
            # `%` y `_` del texto se escapan: son comodines de LIKE.
            escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped.lower()}%"
            matches = [
                func.lower(UserModel.full_name).like(pattern, escape="\\"),
                func.lower(UserModel.email).like(pattern, escape="\\"),
            ]
            if also_user_ids:
                matches.append(UserModel.id.in_(list(also_user_ids)))
            stmt = stmt.where(or_(*matches))
        if role is not None:
            stmt = stmt.where(UserModel.role == role.value)
        if status is not None:
            stmt = stmt.where(UserModel.status == status.value)
        if verified is not None:
            stmt = stmt.where(UserModel.is_verified.is_(verified))
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await self._session.execute(stmt)
        return [_to_entity(model) for model in result.scalars().all()]

    async def count_signups_by_origin(
        self,
        *,
        start: datetime,
        end: datetime,
        exclude_emails: frozenset[str] = frozenset(),
    ) -> list[SignupOriginCount]:
        stmt = (
            select(UserModel.signup_origin, UserModel.role, func.count())
            .where(
                UserModel.created_at >= start,
                UserModel.created_at < end,
                UserModel.role.in_((UserRole.WORKER.value, UserRole.EMPLOYER.value)),
            )
            .group_by(UserModel.signup_origin, UserModel.role)
        )
        if exclude_emails:
            stmt = stmt.where(UserModel.email.notin_(exclude_emails))
        rows = (await self._session.execute(stmt)).all()
        return [
            SignupOriginCount(origin=origin, role=UserRole(role), count=count)
            for origin, role, count in rows
        ]

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
        rotated_at=model.rotated_at,
        replaced_by=model.replaced_by,
    )


def _session_to_model(session: RefreshSession) -> RefreshSessionModel:
    """Fila nueva para una sesión de refresh recién emitida."""
    return RefreshSessionModel(
        id=session.id,
        user_id=session.user_id,
        jti=session.jti,
        expires_at=session.expires_at,
        revoked_at=session.revoked_at,
    )


class SqlAlchemyRefreshSessionRepository(RefreshSessionRepository):
    """Implementación del puerto RefreshSessionRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, session: RefreshSession) -> RefreshSession:
        model = _session_to_model(session)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _session_to_entity(model)

    async def get_by_jti(self, jti: str) -> RefreshSession | None:
        # `populate_existing`: la fila puede haber cambiado desde otra conexión
        # después de una lectura anterior en esta misma sesión (la rotación
        # que perdió la carrera vuelve a leer, ver `IdentityService.refresh`).
        stmt = (
            select(RefreshSessionModel)
            .where(RefreshSessionModel.jti == jti)
            .execution_options(populate_existing=True)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _session_to_entity(model) if model else None

    async def revoke(self, jti: str) -> None:
        await self._session.execute(
            update(RefreshSessionModel)
            .where(RefreshSessionModel.jti == jti, RefreshSessionModel.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
            .execution_options(synchronize_session=False)
        )
        await self._session.commit()

    async def rotate(self, jti: str, now: datetime, successor: RefreshSession) -> bool:
        # Leer y después escribir dejaba ganar a los dos pedidos (CON-03): la
        # condición va en el mismo UPDATE y la base decide quién llegó primero.
        # La sucesora se guarda en la misma transacción: quien vea la rotación
        # ve también la fila de `replaced_by`.
        result = await self._session.execute(
            update(RefreshSessionModel)
            .where(RefreshSessionModel.jti == jti, RefreshSessionModel.revoked_at.is_(None))
            .values(revoked_at=now, rotated_at=now, replaced_by=successor.jti)
            .execution_options(synchronize_session=False)
        )
        if (result.rowcount or 0) != 1:
            await self._session.rollback()
            return False
        self._session.add(_session_to_model(successor))
        await self._session.commit()
        return True

    async def use_rotation_grace(
        self, rotated: RefreshSession, now: datetime, successor: RefreshSession
    ) -> bool:
        # Orden de las filas: primero la sucesora (viva) y después la rotada,
        # el mismo que usa `revoke_all_for_user` (vivas y después rotadas).
        # En el orden inverso las dos se bloqueaban entre sí en Postgres
        # (revisión de seguridad del 2026-11-19).
        #
        # La sucesora que el cliente no recibió deja de servir. Si ya no
        # estaba viva (salió con ella, contraseña nueva, la rotó), no hay
        # gracia.
        revoked = await self._session.execute(
            update(RefreshSessionModel)
            .where(
                RefreshSessionModel.jti == rotated.replaced_by,
                RefreshSessionModel.revoked_at.is_(None),
            )
            .values(revoked_at=now)
            .execution_options(synchronize_session=False)
        )
        # Una sola vez: la ventana se marca usada borrando `rotated_at`, con la
        # condición en el mismo UPDATE (de dos pedidos con el token viejo, uno
        # solo la usa: el segundo espera la fila de la sucesora y la encuentra
        # ya revocada).
        claimed = None
        if (revoked.rowcount or 0) == 1:
            claimed = await self._session.execute(
                update(RefreshSessionModel)
                .where(
                    RefreshSessionModel.jti == rotated.jti,
                    RefreshSessionModel.replaced_by == rotated.replaced_by,
                    RefreshSessionModel.rotated_at >= now - REFRESH_ROTATION_GRACE,
                )
                .values(rotated_at=None, replaced_by=successor.jti)
                .execution_options(synchronize_session=False)
            )
        if claimed is None or (claimed.rowcount or 0) != 1:
            await self._session.rollback()
            return False
        self._session.add(_session_to_model(successor))
        await self._session.commit()
        return True

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        await self._session.execute(
            update(RefreshSessionModel)
            .where(
                RefreshSessionModel.user_id == user_id,
                RefreshSessionModel.revoked_at.is_(None),
            )
            .values(revoked_at=now)
            .execution_options(synchronize_session=False)
        )
        # Las rotadas dentro del plazo pierden la gracia: tras una contraseña
        # nueva, una suspensión o un robo, el token de hace unos segundos
        # tampoco sirve. Las más viejas ya no la tienen; quedan como están.
        await self._session.execute(
            update(RefreshSessionModel)
            .where(
                RefreshSessionModel.user_id == user_id,
                RefreshSessionModel.rotated_at >= now - REFRESH_ROTATION_GRACE,
            )
            .values(rotated_at=None)
            .execution_options(synchronize_session=False)
        )
        await self._session.commit()

    async def delete_expired_before(self, cutoff: datetime) -> int:
        result = await self._session.execute(
            delete(RefreshSessionModel).where(RefreshSessionModel.expires_at < cutoff)
        )
        await self._session.commit()
        return result.rowcount or 0

    async def user_ids_ended_by_revocation(
        self, user_ids: list[UUID], *, now: datetime, revoked_grace: timedelta
    ) -> set[UUID]:
        if not user_ids:
            return set()
        alive = and_(
            RefreshSessionModel.expires_at > now,
            or_(
                RefreshSessionModel.revoked_at.is_(None),
                RefreshSessionModel.revoked_at > now - revoked_grace,
            ),
        )
        # Una fila por cuenta que tenga sesiones: si le queda alguna viva,
        # cuándo se creó la última, y cuándo la última sin revocar.
        stmt = (
            select(
                RefreshSessionModel.user_id,
                func.max(case((alive, 1), else_=0)),
                func.max(RefreshSessionModel.created_at),
                func.max(
                    case(
                        (RefreshSessionModel.revoked_at.is_(None), RefreshSessionModel.created_at)
                    )
                ),
            )
            .where(RefreshSessionModel.user_id.in_(user_ids))
            .group_by(RefreshSessionModel.user_id)
        )
        ended: set[UUID] = set()
        for user_id, has_alive, latest, latest_unrevoked in await self._session.execute(stmt):
            if has_alive:
                continue
            # La más reciente está revocada: no hay ninguna sin revocar, o
            # todas las que quedan sin revocar son anteriores a la última.
            if latest_unrevoked is None or latest_unrevoked < latest:
                ended.add(user_id)
        return ended


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


def _acceptance_to_entity(model: TermsAcceptanceModel) -> TermsAcceptance:
    return TermsAcceptance(
        id=model.id,
        user_id=model.user_id,
        version=model.version,
        channel=TermsAcceptanceChannel(model.channel),
        accepted_at=model.accepted_at,
    )


class SqlAlchemyTermsAcceptanceRepository(TermsAcceptanceRepository):
    """Implementación del puerto TermsAcceptanceRepository sobre SQLAlchemy async."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, acceptance: TermsAcceptance) -> TermsAcceptance:
        model = TermsAcceptanceModel(
            id=acceptance.id,
            user_id=acceptance.user_id,
            version=acceptance.version,
            channel=acceptance.channel.value,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _acceptance_to_entity(model)

    async def list_for_user(self, user_id: UUID) -> list[TermsAcceptance]:
        result = await self._session.execute(
            select(TermsAcceptanceModel)
            .where(TermsAcceptanceModel.user_id == user_id)
            .order_by(desc(TermsAcceptanceModel.accepted_at))
        )
        return [_acceptance_to_entity(m) for m in result.scalars().all()]
