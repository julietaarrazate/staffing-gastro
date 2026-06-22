"""Casos de uso del módulo de administración.

Reutiliza el puerto `UserRepository` del módulo identity: no introduce
persistencia propia, sólo orquesta operaciones de moderación de usuarios.
"""

from uuid import UUID

from app.modules.admin.application.dtos import PlatformStats
from app.modules.admin.application.exceptions import (
    CannotModifySelfError,
    TargetUserNotFoundError,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole, UserStatus


class AdminService:
    """Servicio de aplicación con los casos de uso del panel de administración."""

    def __init__(self, users: UserRepository) -> None:
        self._users = users

    async def list_users(self) -> list[User]:
        """Lista todos los usuarios (más recientes primero)."""
        return await self._users.list_all()

    async def get_stats(self) -> PlatformStats:
        """Calcula métricas agregadas de la plataforma."""
        users = await self._users.list_all()
        return PlatformStats(
            total_users=len(users),
            workers=sum(1 for u in users if u.role == UserRole.WORKER),
            employers=sum(1 for u in users if u.role == UserRole.EMPLOYER),
            admins=sum(1 for u in users if u.role == UserRole.ADMIN),
            active=sum(1 for u in users if u.status == UserStatus.ACTIVE),
            suspended=sum(1 for u in users if u.status == UserStatus.SUSPENDED),
            verified=sum(1 for u in users if u.is_verified),
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
