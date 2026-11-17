"""Entidad de la encuesta para locales (sin frameworks)."""

import re
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from statistics import median
from uuid import UUID, uuid4

from app.modules.encuesta.domain.exceptions import InvalidSurveyError
from app.modules.encuesta.domain.value_objects import (
    DECIDES,
    PAY_PER_SHIFT_MAX_ARS,
    PAY_PER_SHIFT_MIN_ARS,
    AbsenceOutcome,
    Channel,
    EventualRange,
    LocalKind,
    PricingPreference,
    RespondentRole,
    Role,
    TeamModel,
)

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _phone_digits(phone: str) -> int:
    return len(re.sub(r"\D", "", phone))


@dataclass(frozen=True)
class SurveyResponse:
    """Una respuesta a la encuesta pública. No guarda IP ni cuenta: sólo lo
    que la persona contestó y, si quiso, cómo escribirle (ADR-0025)."""

    id: UUID
    respondent_role: RespondentRole
    business_name: str
    barrio: str
    local_kind: LocalKind
    team_model: TeamModel
    eventuals_normal_month: EventualRange
    eventuals_peak_month: EventualRange
    roles: tuple[Role, ...]
    current_channels: tuple[Channel, ...]
    last_absence_outcome: tuple[AbsenceOutcome, ...]
    pricing_preference: PricingPreference
    wants_beta: bool
    created_at: datetime
    pay_per_shift_ars: int | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    consent_at: datetime | None = None
    source: str | None = None
    client_key: str | None = None

    @property
    def has_contact(self) -> bool:
        """Dato personal de contacto. El nombre del local no cuenta: es el
        nombre de un comercio y es obligatorio."""
        return any((self.contact_name, self.phone, self.email))

    @property
    def decides(self) -> bool:
        return self.respondent_role in DECIDES

    @classmethod
    def create(
        cls,
        *,
        respondent_role: RespondentRole,
        business_name: str,
        barrio: str,
        local_kind: LocalKind,
        team_model: TeamModel,
        eventuals_normal_month: EventualRange,
        eventuals_peak_month: EventualRange,
        pricing_preference: PricingPreference,
        roles: list[Role] | tuple[Role, ...] = (),
        current_channels: list[Channel] | tuple[Channel, ...] = (),
        last_absence_outcome: list[AbsenceOutcome] | tuple[AbsenceOutcome, ...] = (),
        pay_per_shift_ars: int | None = None,
        wants_beta: bool = False,
        contact_name: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        consent: bool = False,
        source: str | None = None,
        client_key: str | None = None,
        now: datetime | None = None,
    ) -> "SurveyResponse":
        """Arma una respuesta válida o lanza `InvalidSurveyError`."""
        now = now or datetime.now(timezone.utc)
        if pay_per_shift_ars is not None and not (
            PAY_PER_SHIFT_MIN_ARS <= pay_per_shift_ars <= PAY_PER_SHIFT_MAX_ARS
        ):
            raise InvalidSurveyError(
                "El pago por jornada tiene que estar entre "
                f"${PAY_PER_SHIFT_MIN_ARS:,} y ${PAY_PER_SHIFT_MAX_ARS:,}".replace(",", ".")
            )
        business_name, barrio = _clean(business_name), _clean(barrio)
        if not business_name:
            raise InvalidSurveyError("Escribí el nombre del local")
        if len(business_name) > 160:
            raise InvalidSurveyError("El nombre del local es demasiado largo")
        if not barrio:
            raise InvalidSurveyError("Escribí el barrio del local")
        if len(barrio) > 80:
            raise InvalidSurveyError("El barrio es demasiado largo")
        phone, email = _clean(phone), _clean(email)
        if phone is not None and _phone_digits(phone) < 8:
            raise InvalidSurveyError("El teléfono parece incompleto")
        if email is not None and not _EMAIL.match(email):
            raise InvalidSurveyError("El email no parece válido")
        if wants_beta and not (phone or email):
            raise InvalidSurveyError(
                "Para sumarte a la beta dejanos un teléfono o un email"
            )
        response = cls(
            id=uuid4(),
            respondent_role=respondent_role,
            local_kind=local_kind,
            team_model=team_model,
            eventuals_normal_month=eventuals_normal_month,
            eventuals_peak_month=eventuals_peak_month,
            roles=tuple(dict.fromkeys(roles)),
            current_channels=tuple(dict.fromkeys(current_channels)),
            last_absence_outcome=tuple(dict.fromkeys(last_absence_outcome)),
            pricing_preference=pricing_preference,
            wants_beta=wants_beta,
            created_at=now,
            barrio=barrio,
            pay_per_shift_ars=pay_per_shift_ars,
            contact_name=_clean(contact_name),
            business_name=business_name,
            phone=phone,
            email=email,
            source=_clean(source),
            client_key=_clean(client_key),
        )
        if response.has_contact:
            if not consent:
                raise InvalidSurveyError(
                    "Para guardar tus datos de contacto necesitamos tu consentimiento"
                )
            response = replace(response, consent_at=now)
        return response

    def without_contact(self) -> "SurveyResponse":
        """La misma respuesta como estadística anónima (retención a 12 meses)."""
        return replace(
            self, contact_name=None, phone=None, email=None
        )


@dataclass(frozen=True)
class SurveySummary:
    total: int
    # Cuántas contestó quien decide (dueño o encargado): sobre ellas se
    # calculan las distribuciones y la mediana.
    deciders: int
    with_contact: int
    team_model: dict[str, int]
    eventuals_normal_month: dict[str, int]
    roles: dict[str, int]
    pricing_preference: dict[str, int]
    pay_per_shift_median_ars: int | None
    pay_per_shift_samples: int


def _count(values: list[str], options: list[str]) -> dict[str, int]:
    counts = {option: 0 for option in options}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return counts


def summarize(responses: list[SurveyResponse]) -> SurveySummary:
    """Totales y distribuciones. Las distribuciones y la mediana usan sólo las
    respuestas de quien decide (dueño o encargado); `total` y `with_contact`
    cuentan todas. Todas las opciones aparecen, también con 0."""
    everyone, responses = responses, [r for r in responses if r.decides]
    pays = [r.pay_per_shift_ars for r in responses if r.pay_per_shift_ars is not None]
    return SurveySummary(
        total=len(everyone),
        deciders=len(responses),
        # «Con contacto para la beta»: quiso sumarse y dejó cómo escribirle.
        # Una respuesta vieja, ya sin contacto, no cuenta.
        with_contact=sum(1 for r in everyone if r.wants_beta and r.has_contact),
        team_model=_count([r.team_model.value for r in responses], [o.value for o in TeamModel]),
        eventuals_normal_month=_count(
            [r.eventuals_normal_month.value for r in responses],
            [o.value for o in EventualRange],
        ),
        roles=_count([role.value for r in responses for role in r.roles], [o.value for o in Role]),
        pricing_preference=_count(
            [r.pricing_preference.value for r in responses],
            [o.value for o in PricingPreference],
        ),
        pay_per_shift_median_ars=round(median(pays)) if pays else None,
        pay_per_shift_samples=len(pays),
    )
