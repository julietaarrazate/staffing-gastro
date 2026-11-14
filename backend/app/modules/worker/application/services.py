"""Casos de uso del módulo worker (perfil del trabajador)."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from app.core.tz import now_art
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
_EARNED_STATUSES = frozenset({ShiftStatus.FINALIZADO, ShiftStatus.PAGADO})


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

    async def go_available_now(
        self, user_id: UUID, latitude: float, longitude: float
    ) -> WorkerProfile:
        """Prende "Disponible ahora" (ADR-0014): ver `WorkerProfile.go_available_now`."""
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))
        profile.go_available_now(latitude, longitude)
        return await self._profiles.update(profile)

    async def stop_available_now(self, user_id: UUID) -> None:
        """Apaga "Disponible ahora" a mano. Idempotente: no falla si ya
        estaba apagado, ni si el perfil no existe (usado también best-effort
        desde `logout`, donde cualquier usuario puede no ser trabajador)."""
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            return
        profile.stop_available_now()
        await self._profiles.update(profile)

    async def get_my_earnings_summary(self, user_id: UUID) -> WorkerEarningsSummary:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise WorkerProfileNotFoundError(str(user_id))

        # Mes calendario actual en hora argentina: [día 1 00:00, día 1 del mes
        # siguiente 00:00). La suma corre en la base, sin tope de filas.
        today = now_art()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month_start = (
            month_start.replace(year=month_start.year + 1, month=1)
            if month_start.month == 12
            else month_start.replace(month=month_start.month + 1)
        )
        totals = await self._shifts.sum_worker_earnings(
            profile.id,
            _EARNED_STATUSES,
            window_start=month_start,
            window_end=next_month_start,
        )
        return WorkerEarningsSummary(
            total_earned=totals.total,
            this_month_earned=totals.in_window,
            shifts_completed=totals.count,
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
