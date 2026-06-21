"""Adaptador de persistencia: implementación SQLAlchemy del UserRepository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repositories import UserRepository
from app.modules.identity.domain.value_objects import UserRole, UserStatus
from app.modules.identity.infrastructure.models import UserModel


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
