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
    photo_url: str | None = None


class ImpersonateResponse(BaseModel):
    """Token de "ver como" (sin refresh: sesión de vida corta, ver
    `AdminService.impersonate`) + el usuario impersonado."""

    access_token: str
    token_type: str = "bearer"
    user: AdminUserResponse


class TestAccountResponse(BaseModel):
    """Cuenta de prueba (trabajador o comercio) para "Ver como", ver
    `AdminService.get_or_create_test_accounts`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole


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

    shift_assignment_rate_sample_size: int
    shift_assignment_rate_pct: float | None

    shift_completion_rate_sample_size: int
    shift_completion_rate_pct: float | None

    application_acceptance_sample_size: int
    application_to_acceptance_rate_pct: float | None

    no_show_sample_size: int
    no_show_rate_pct: float | None

    worker_completion_repeat_sample_size: int
    worker_completion_repeat_rate_pct: float | None

    employer_repeat_sample_size: int
    employer_repeat_rate_pct: float | None
