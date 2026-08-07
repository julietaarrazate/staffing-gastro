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


class ImpersonateResponse(BaseModel):
    """Token de "ver como" (sin refresh: sesión de vida corta, ver
    `AdminService.impersonate`) + el usuario impersonado."""

    access_token: str
    token_type: str = "bearer"
    user: AdminUserResponse


class PlatformStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_users: int
    workers: int
    employers: int
    admins: int
    active: int
    suspended: int
    verified: int
    coverage_sample_size: int
    avg_time_to_fill_minutes: float | None
    pct_filled_under_10_min: float | None
