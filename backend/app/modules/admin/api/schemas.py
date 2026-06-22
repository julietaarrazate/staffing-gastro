"""Esquemas HTTP (Pydantic) del módulo de administración."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.modules.identity.domain.value_objects import UserRole, UserStatus


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    status: UserStatus
    is_verified: bool
    created_at: datetime | None = None


class PlatformStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_users: int
    workers: int
    employers: int
    admins: int
    active: int
    suspended: int
    verified: int
