"""Casos de uso del módulo worker (perfil del trabajador)."""

from uuid import UUID

from app.modules.worker.application.dtos import WorkerProfileData
from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.exceptions import (
    WorkerProfileAlreadyExistsError,
    WorkerProfileNotFoundError,
)
from app.modules.worker.domain.repositories import WorkerProfileRepository


class WorkerProfileService:
    """Servicio de aplicación para gestionar el perfil del trabajador."""

    def __init__(self, profiles: WorkerProfileRepository) -> None:
        self._profiles = profiles

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
