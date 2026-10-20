"""Esquemas HTTP (Pydantic) del módulo de administración."""

from datetime import datetime
from decimal import Decimal
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


class AdminWorkerSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    city: str | None = None
    skills: list[str] = []
    years_experience: int = 0
    is_available: bool = True
    rating: float = 0.0
    events_completed: int = 0
    punctuality_rate: float = 0.0
    cancellations: int = 0
    no_shows: int = 0
    level: str


class AdminCompanySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    category: str | None = None
    address: str | None = None
    city: str | None = None
    rating: float = 0.0
    events_published: int = 0
    on_time_payment_rate: float = 0.0
    late_cancellations: int = 0


class AdminShiftRowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None = None
    position: str
    start_at: datetime
    status: str
    pay_amount: Decimal


class AdminTicketRowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject: str
    status: str
    created_at: datetime | None = None


class AdminUserDetailResponse(BaseModel):
    """Ficha de una persona (`GET /admin/users/{id}`)."""

    model_config = ConfigDict(from_attributes=True)

    user: AdminUserResponse
    worker: AdminWorkerSummaryResponse | None = None
    company: AdminCompanySummaryResponse | None = None
    recent_shifts: list[AdminShiftRowResponse] = []
    tickets: list[AdminTicketRowResponse] = []


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


class SubscriptionStatsResponse(BaseModel):
    """Ver `AdminService.get_subscription_stats`."""

    model_config = ConfigDict(from_attributes=True)

    mrr_ars: Decimal
    total_companies: int
    companies_by_plan: dict[str, int]
    companies_at_plan_limit: int
    billing_enabled: bool
