"""Casos de uso del módulo de administración.

Reutiliza los puertos `UserRepository` (identity) y `ShiftRepository`
(shift): no introduce persistencia propia, sólo orquesta operaciones de
moderación de usuarios y el cálculo de métricas agregadas.
"""

from datetime import datetime
from uuid import UUID

from app.modules.admin.application.dtos import PlatformStats
from app.modules.admin.application.exceptions import (
    CannotModifySelfError,
    TargetUserNotFoundError,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole, UserStatus
from app.modules.shift.domain.repositories import ShiftRepository


def _naive(dt: datetime) -> datetime:
    """Mismo criterio que `shift/application/services.py::_naive`: en SQLite
    (tests) los datetimes vuelven sin tzinfo; en Postgres las columnas
    `TIMESTAMPTZ` sí lo preservan. Se asume que ambos están en UTC."""
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


class AdminService:
    """Servicio de aplicación con los casos de uso del panel de administración."""

    def __init__(self, users: UserRepository, shifts: ShiftRepository) -> None:
        self._users = users
        self._shifts = shifts

    async def list_users(self, *, limit: int = 50, offset: int = 0) -> list[User]:
        """Lista usuarios paginados (más recientes primero)."""
        return await self._users.list_all(limit=limit, offset=offset)

    async def get_stats(self) -> PlatformStats:
        """Calcula métricas agregadas de la plataforma, incluida la promesa
        central del negocio ("cubrir un puesto en <10 minutos", ver
        `Shift.published_at`/`first_assigned_at`)."""
        users = await self._users.list_all()
        filled_shifts = await self._shifts.list_recently_filled()
        minutes = [
            (_naive(s.first_assigned_at) - _naive(s.published_at)).total_seconds() / 60
            for s in filled_shifts
            if s.published_at is not None and s.first_assigned_at is not None
        ]
        return PlatformStats(
            total_users=len(users),
            workers=sum(1 for u in users if u.role == UserRole.WORKER),
            employers=sum(1 for u in users if u.role == UserRole.EMPLOYER),
            admins=sum(1 for u in users if u.role == UserRole.ADMIN),
            active=sum(1 for u in users if u.status == UserStatus.ACTIVE),
            suspended=sum(1 for u in users if u.status == UserStatus.SUSPENDED),
            verified=sum(1 for u in users if u.is_verified),
            coverage_sample_size=len(minutes),
            avg_time_to_fill_minutes=(sum(minutes) / len(minutes)) if minutes else None,
            pct_filled_under_10_min=(
                (sum(1 for m in minutes if m <= 10) / len(minutes)) * 100 if minutes else None
            ),
        )

    async def suspend_user(self, actor: User, user_id: UUID) -> User:
        """Suspende a un usuario. No permite que un admin se suspenda a sí mismo."""
        if actor.id == user_id:
            raise CannotModifySelfError()
        user = await self._get(user_id)
        user.suspend()
        return await self._users.update(user)

    async def activate_user(self, user_id: UUID) -> User:
        """Reactiva a un usuario suspendido."""
        user = await self._get(user_id)
        user.activate()
        return await self._users.update(user)

    async def verify_user(self, user_id: UUID) -> User:
        """Marca a un usuario como verificado."""
        user = await self._get(user_id)
        user.verify()
        return await self._users.update(user)

    async def promote_to_admin(self, user_id: UUID) -> User:
        """Promueve a un usuario al rol de administrador."""
        user = await self._get(user_id)
        user.promote_to_admin()
        return await self._users.update(user)

    async def _get(self, user_id: UUID) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise TargetUserNotFoundError()
        return user
