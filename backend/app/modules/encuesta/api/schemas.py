"""Esquemas HTTP (Pydantic) del módulo encuesta."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.encuesta.domain.value_objects import (
    AbsenceOutcome,
    Channel,
    EventualRange,
    LocalKind,
    PricingPreference,
    Role,
    TeamModel,
)


class SurveySubmitRequest(BaseModel):
    local_kind: LocalKind
    barrio: str | None = Field(default=None, max_length=80)
    team_model: TeamModel
    eventuals_normal_month: EventualRange
    eventuals_peak_month: EventualRange
    roles: list[Role] = Field(default_factory=list, max_length=9)
    current_channels: list[Channel] = Field(default_factory=list, max_length=5)
    pay_per_shift_ars: int | None = None
    last_absence_outcome: list[AbsenceOutcome] = Field(default_factory=list, max_length=5)
    pricing_preference: PricingPreference
    wants_beta: bool = False
    contact_name: str | None = Field(default=None, max_length=120)
    business_name: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=200)
    consent: bool = False
    source: str | None = Field(default=None, max_length=60)
    # Honeypot: un campo que una persona no ve. Si viene con algo, es un robot.
    company_website: str | None = Field(default=None, max_length=500)


class SurveyReceivedResponse(BaseModel):
    received: bool = True


class SurveyResponseOut(BaseModel):
    id: UUID
    created_at: datetime
    local_kind: LocalKind
    barrio: str | None = None
    team_model: TeamModel
    eventuals_normal_month: EventualRange
    eventuals_peak_month: EventualRange
    roles: list[Role]
    current_channels: list[Channel]
    pay_per_shift_ars: int | None = None
    last_absence_outcome: list[AbsenceOutcome]
    pricing_preference: PricingPreference
    wants_beta: bool
    contact_name: str | None = None
    business_name: str | None = None
    phone: str | None = None
    email: str | None = None
    consent_at: datetime | None = None
    source: str | None = None


class SurveyListResponse(BaseModel):
    items: list[SurveyResponseOut]
    total: int


class SurveySummaryResponse(BaseModel):
    total: int
    with_contact: int
    team_model: dict[str, int]
    eventuals_normal_month: dict[str, int]
    roles: dict[str, int]
    pricing_preference: dict[str, int]
    pay_per_shift_median_ars: int | None = None
    pay_per_shift_samples: int
