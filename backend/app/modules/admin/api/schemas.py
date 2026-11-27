"""Esquemas HTTP (Pydantic) del módulo de administración."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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


class SuspensionPreviewResponse(BaseModel):
    """Cuántos turnos toca suspender una cuenta (ADR-0024): lo que se oculta
    (turnos abiertos del comercio), lo que se cancela con aviso (turnos del
    comercio con alguien asignado o confirmado) y lo que se reabre con aviso
    (turnos del trabajador)."""

    model_config = ConfigDict(from_attributes=True)

    hidden: int
    cancelled: int
    reopened: int


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
    payments_recorded: int = 0
    late_cancellations: int = 0


class AdminCloseActionResponse(BaseModel):
    """Qué haría «Cerrar turno» (decisión 21): marcar la salida, cerrar el
    turno o las dos cosas, y a quién se avisa (`company`, `worker` o nadie)."""

    model_config = ConfigDict(from_attributes=True)

    check_out: bool
    finish: bool
    notifies: str | None = None


class AdminShiftRowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None = None
    position: str
    start_at: datetime
    status: str
    pay_amount: Decimal
    # Lo que se cobra (`Shift.amount_due`): en un turno reofrecido con la
    # llegada marcada, lo que restaba desde la llegada (U080).
    amount_due: Decimal
    absent: bool = False
    # Sólo en la ficha de una cuenta suspendida, en los turnos donde aplica.
    admin_close: AdminCloseActionResponse | None = None


class AdminShiftCloseRequest(BaseModel):
    """Lo que la admin vio y confirmó en el diálogo de «Cerrar turno» (el
    `admin_close` de la ficha). Si ahora se haría otra cosa, 409."""

    check_out: bool
    finish: bool


class AdminShiftClosureResponse(BaseModel):
    """Resultado de «Cerrar turno» (`POST /admin/shifts/{id}/close`)."""

    model_config = ConfigDict(from_attributes=True)

    shift_id: UUID
    status: str
    check_out: bool
    finish: bool
    notifies: str | None = None
    checked_out_at: datetime | None = None


class AdminTicketRowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject: str
    status: str
    created_at: datetime | None = None


class AdminCommitmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    at: datetime
    plan_code: str
    plan_name: str
    price_ars: Decimal


class AdminSubscriptionSummaryResponse(BaseModel):
    """Bloque «Plan» de la ficha de un comercio."""

    model_config = ConfigDict(from_attributes=True)

    plan_code: str
    plan_name: str
    chosen_plan_code: str | None = None
    chosen_plan_name: str | None = None
    chosen_plan_at: datetime | None = None
    commitment: AdminCommitmentResponse | None = None


class PaymentCommitmentRequest(BaseModel):
    """`PUT /admin/users/{id}/payment-commitment`: precio mensual acordado,
    en pesos enteros."""

    plan_code: str = Field(min_length=1, max_length=40)
    price_ars: int = Field(gt=0, le=100_000_000)


class AdminUserDetailResponse(BaseModel):
    """Ficha de una persona (`GET /admin/users/{id}`)."""

    model_config = ConfigDict(from_attributes=True)

    user: AdminUserResponse
    worker: AdminWorkerSummaryResponse | None = None
    company: AdminCompanySummaryResponse | None = None
    recent_shifts: list[AdminShiftRowResponse] = []
    tickets: list[AdminTicketRowResponse] = []
    subscription: AdminSubscriptionSummaryResponse | None = None


class ImpersonateResponse(BaseModel):
    """Token de "ver como" (sin refresh: sesión de vida corta, ver
    `AdminService.impersonate`) + el usuario impersonado."""

    access_token: str
    token_type: str = "bearer"
    user: AdminUserResponse
    # La sesión no puede cambiar nada (PRI-09). Falso sólo para las cuentas
    # de prueba del panel, que existen para probar los flujos.
    read_only: bool = True


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

    employer_return_30d_sample_size: int
    employer_return_30d_rate_pct: float | None


class SubscriptionStatsResponse(BaseModel):
    """Ver `AdminService.get_subscription_stats`."""

    model_config = ConfigDict(from_attributes=True)

    mrr_ars: Decimal
    total_companies: int
    companies_by_plan: dict[str, int]
    companies_at_plan_limit: int
    companies_with_chosen_plan: dict[str, int] = {}
    committed_companies: int = 0
    committed_mrr_ars: Decimal = Decimal("0")
    billing_enabled: bool


class LiveShiftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None = None
    position: str
    status: str
    start_at: datetime
    end_at: datetime
    city: str | None = None
    company_name: str | None = None
    urgent: bool
    escalated: bool
    escalated_at: datetime | None = None
    published_at: datetime
    minutes_open: int
    applications: int
    no_show_at: datetime | None = None


class LiveShiftsResponse(BaseModel):
    """Ver `AdminService.list_live_shifts`."""

    model_config = ConfigDict(from_attributes=True)

    generated_at: datetime
    total: int
    urgent: int
    escalated: int
    no_shows: int = 0
    shown_live: int = 0
    limit: int = 0
    shifts: list[LiveShiftResponse]


class TodayCountsResponse(BaseModel):
    """Ver `AdminService.get_today_counts`."""

    model_config = ConfigDict(from_attributes=True)

    urgent_uncovered: int
    no_shows_today: int


class PeriodSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    start: datetime
    end: datetime
    shifts_published: int
    shifts_covered: int
    covered_pct: float | None = None
    covered_under_10_min_pct: float | None = None
    avg_minutes_to_cover: float | None = None
    applications: int
    median_minutes_to_cover: float | None = None
    short_notice_covered: int = 0
    short_notice_under_10_min_pct: float | None = None
    fulfilled: int = 0
    fulfilled_pct: float | None = None
    active_companies: int = 0
    companies_with_covered: int = 0


class SignupsByOriginResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # `None` = cuentas anteriores a que se guardara el origen.
    origin: str | None
    workers: int
    companies: int
    total: int


class PeriodMetricsResponse(BaseModel):
    """Ver `AdminService.get_period_metrics`."""

    model_config = ConfigDict(from_attributes=True)

    days: int
    current: PeriodSummaryResponse
    previous: PeriodSummaryResponse
    signups_by_origin: list[SignupsByOriginResponse] = []


class WeekSummaryResponse(BaseModel):
    """Una semana de la serie M7: ver `WeekSummary`."""

    model_config = ConfigDict(from_attributes=True)

    start: datetime
    end: datetime
    in_progress: bool
    shifts_published: int
    shifts_covered: int
    covered_pct: float | None = None
    fulfilled: int
    fulfilled_pct: float | None = None
    median_minutes_to_cover: float | None = None
    short_notice_covered: int
    short_notice_under_10_min_pct: float | None = None
    active_companies: int
    companies_with_covered: int
    signups_workers: int
    signups_companies: int
    signups_by_origin: list[SignupsByOriginResponse] = []


class WeeklyMetricsResponse(BaseModel):
    """Ver `AdminService.get_weekly_metrics`."""

    model_config = ConfigDict(from_attributes=True)

    weeks: list[WeekSummaryResponse]
