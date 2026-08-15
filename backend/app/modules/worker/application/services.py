"""Casos de uso del módulo worker (perfil del trabajador)."""

from dataclasses import dataclass
from datetime import timezone
from decimal import Decimal
from uuid import UUID

from app.core.tz import ARG_TZ, now_art
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import ShiftStatus
from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.exceptions import (
    WorkerProfileAlreadyExistsError,
    WorkerProfileNotFoundError,
)
from app.modules.worker.domain.repositories import WorkerProfileRepository

# Un turno "ganado" es uno ya trabajado, cuente o no todavía como "cobrado"
# en el sistema — mismo criterio que `shifts_together` en
# `favorite/infrastructure/repositories.py`, que junta FINALIZADO/PAGADO
# como "turno completado" sin distinguir si ya se marcó el pago.
_EARNED_STATUSES = (ShiftStatus.FINALIZADO.value, ShiftStatus.PAGADO.value)

# Tope de turnos considerados al sumar ganancias — mismo criterio que
# `AssistantService._LOOKUP_LIMIT`: un trabajador de la beta no se acerca a
# este volumen; de sobrarse, mejor señal de que hace falta un agregado en
# SQL que fallar en silencio.
_EARNINGS_LOOKUP_LIMIT = 500


@dataclass(frozen=True)
class WorkerEarningsSummary:
    """Resumen de ganancias para el perfil del trabajador (pedido de
    Julieta: "un resumen de ganancias acumuladas ... por mes"). `total_earned`
    suma TODOS los turnos ya trabajados; `this_month_earned`, sólo los que
    ocurrieron en el mes calendario actual (hora de Argentina)."""

    total_earned: Decimal
    this_month_earned: Decimal
    shifts_completed: int


class WorkerProfileService:
    """Servicio de aplicación para gestionar el perfil del trabajador."""

    def __init__(self, profiles: WorkerProfileRepository, shifts: ShiftRepository) -> None:
        self._profiles = profiles
        self._shifts = shifts

    async def create_profile(
        self, user_id: UUID, data: WorkerProfileData
    ) -> WorkerProfile:
        """Crea el perfil del trabajador. Falla si el usuario ya tiene uno."""
        if await self._profiles.exists_by_user_id(user_id):
            raise WorkerProfileAlreadyExistsError(str(user_id))

        profile = WorkerProfile(user_id=user_id)
        _apply(profile, data)
        return await self._profiles.add(profile)

    async def update_profile(
        self, user_id: UUID, data: WorkerProfileData
    ) -> WorkerProfile:
        """Actualiza el perfil del trabajador autenticado."""
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))
        _apply(profile, data)
        return await self._profiles.update(profile)

    async def get_my_profile(self, user_id: UUID) -> WorkerProfile:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))
        return profile

    async def get_profile(self, profile_id: UUID) -> WorkerProfile:
        profile = await self._profiles.get_by_id(profile_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(profile_id))
        return profile

    async def get_my_earnings_summary(self, user_id: UUID) -> WorkerEarningsSummary:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))

        shifts = await self._shifts.list_by_worker(profile.id, limit=_EARNINGS_LOOKUP_LIMIT)
        earned = [s for s in shifts if s.status.value in _EARNED_STATUSES]

        today = now_art()
        total = Decimal(0)
        this_month = Decimal(0)
        for shift in earned:
            total += shift.pay_amount
            start_at_art = shift.start_at
            if start_at_art.tzinfo is None:
                start_at_art = start_at_art.replace(tzinfo=timezone.utc)
            start_at_art = start_at_art.astimezone(ARG_TZ)
            if start_at_art.year == today.year and start_at_art.month == today.month:
                this_month += shift.pay_amount

        return WorkerEarningsSummary(
            total_earned=total, this_month_earned=this_month, shifts_completed=len(earned)
        )


def _apply(profile: WorkerProfile, data: WorkerProfileData) -> None:
    """Vuelca los datos editables sobre la entidad (sin tocar métricas)."""
    profile.photo_url = data.photo_url
    profile.birth_date = data.birth_date
    profile.city = data.city
    profile.bio = data.bio
    profile.latitude = data.latitude
    profile.longitude = data.longitude
    profile.skills = data.skills
    profile.years_experience = data.years_experience
    profile.languages = data.languages
    profile.certifications = data.certifications
    profile.cv_url = data.cv_url
    profile.cv_filename = data.cv_filename
    profile.is_available = data.is_available
