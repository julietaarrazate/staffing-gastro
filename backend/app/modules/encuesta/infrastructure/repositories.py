"""Adaptador SQLAlchemy del SurveyRepository."""

from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.encuesta.domain.entities import SurveyResponse
from app.modules.encuesta.domain.repositories import SurveyRepository
from app.modules.encuesta.domain.value_objects import (
    AbsenceOutcome,
    Channel,
    EventualRange,
    LocalKind,
    PricingPreference,
    RespondentRole,
    Role,
    TeamModel,
)
from app.modules.encuesta.infrastructure.models import SurveyResponseModel

_PLAIN = (
    "barrio",
    "business_name",
    "pay_per_shift_ars",
    "wants_beta",
    "contact_name",
    "phone",
    "email",
    "consent_at",
    "source",
    "client_key",
    "created_at",
)
_CONTACT = (
    SurveyResponseModel.contact_name,
    SurveyResponseModel.phone,
    SurveyResponseModel.email,
)


def _to_entity(m: SurveyResponseModel) -> SurveyResponse:
    return SurveyResponse(
        id=m.id,
        respondent_role=RespondentRole(m.respondent_role),
        local_kind=LocalKind(m.local_kind),
        team_model=TeamModel(m.team_model),
        eventuals_normal_month=EventualRange(m.eventuals_normal_month),
        eventuals_peak_month=EventualRange(m.eventuals_peak_month),
        roles=tuple(Role(v) for v in m.roles or []),
        current_channels=tuple(Channel(v) for v in m.current_channels or []),
        last_absence_outcome=tuple(AbsenceOutcome(v) for v in m.last_absence_outcome or []),
        pricing_preference=PricingPreference(m.pricing_preference),
        **{name: getattr(m, name) for name in _PLAIN},
    )


def _to_model(r: SurveyResponse) -> SurveyResponseModel:
    return SurveyResponseModel(
        id=r.id,
        respondent_role=r.respondent_role.value,
        local_kind=r.local_kind.value,
        team_model=r.team_model.value,
        eventuals_normal_month=r.eventuals_normal_month.value,
        eventuals_peak_month=r.eventuals_peak_month.value,
        roles=[v.value for v in r.roles],
        current_channels=[v.value for v in r.current_channels],
        last_absence_outcome=[v.value for v in r.last_absence_outcome],
        pricing_preference=r.pricing_preference.value,
        **{name: getattr(r, name) for name in _PLAIN},
    )


class SqlAlchemySurveyRepository(SurveyRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_client_key(self, client_key: str) -> SurveyResponse | None:
        model = await self._session.scalar(
            select(SurveyResponseModel).where(SurveyResponseModel.client_key == client_key)
        )
        return _to_entity(model) if model else None

    async def get_by_id(self, survey_id: UUID) -> SurveyResponse | None:
        model = await self._session.get(SurveyResponseModel, survey_id)
        return _to_entity(model) if model else None

    async def add(self, response: SurveyResponse) -> bool:
        self._session.add(_to_model(response))
        try:
            await self._session.commit()
        except IntegrityError:
            # Dos pedidos con la misma clave a la vez: gana el primero.
            await self._session.rollback()
            return False
        return True

    async def list_recent(
        self, *, limit: int, offset: int, only_with_contact: bool
    ) -> tuple[list[SurveyResponse], int]:
        query = select(SurveyResponseModel)
        count = select(func.count()).select_from(SurveyResponseModel)
        if only_with_contact:
            has_contact = or_(*(column.is_not(None) for column in _CONTACT))
            query, count = query.where(has_contact), count.where(has_contact)
        total = await self._session.scalar(count) or 0
        result = await self._session.execute(
            query.order_by(SurveyResponseModel.created_at.desc(), SurveyResponseModel.id)
            .limit(limit)
            .offset(offset)
        )
        return [_to_entity(m) for m in result.scalars().all()], total

    async def list_all(self) -> list[SurveyResponse]:
        result = await self._session.execute(select(SurveyResponseModel))
        return [_to_entity(m) for m in result.scalars().all()]

    async def clear_contact(self, survey_id: UUID) -> bool:
        if await self._session.get(SurveyResponseModel, survey_id) is None:
            return False
        await self._session.execute(
            update(SurveyResponseModel)
            .where(SurveyResponseModel.id == survey_id)
            .values(contact_name=None, phone=None, email=None)
        )
        await self._session.commit()
        return True

    async def clear_all_contacts(self) -> int:
        has_contact = or_(*(column.is_not(None) for column in _CONTACT))
        result = await self._session.execute(
            update(SurveyResponseModel)
            .where(has_contact)
            .values(contact_name=None, phone=None, email=None)
        )
        await self._session.commit()
        return result.rowcount or 0
