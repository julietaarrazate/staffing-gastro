"""Casos de uso del módulo company (perfil del comercio)."""

from uuid import UUID

from app.modules.company.application.dtos import CompanyProfileData
from app.modules.company.domain.entities import CompanyProfile
from app.modules.company.domain.exceptions import (
    CompanyProfileAlreadyExistsError,
    CompanyProfileNotFoundError,
)
from app.modules.company.domain.repositories import CompanyProfileRepository


class CompanyProfileService:
    """Servicio de aplicación para gestionar el perfil del comercio."""

    def __init__(self, profiles: CompanyProfileRepository) -> None:
        self._profiles = profiles

    async def create_profile(
        self, user_id: UUID, data: CompanyProfileData
    ) -> CompanyProfile:
        """Crea el perfil del comercio. Falla si el usuario ya tiene uno."""
        if await self._profiles.exists_by_user_id(user_id):
            raise CompanyProfileAlreadyExistsError(str(user_id))

        profile = CompanyProfile(user_id=user_id, name=data.name)
        _apply(profile, data)
        return await self._profiles.add(profile)

    async def update_profile(
        self, user_id: UUID, data: CompanyProfileData
    ) -> CompanyProfile:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise CompanyProfileNotFoundError(str(user_id))
        _apply(profile, data)
        return await self._profiles.update(profile)

    async def get_my_profile(self, user_id: UUID) -> CompanyProfile:
        profile = await self._profiles.get_by_user_id(user_id)
        if profile is None:
            raise CompanyProfileNotFoundError(str(user_id))
        return profile

    async def get_profile(self, profile_id: UUID) -> CompanyProfile:
        profile = await self._profiles.get_by_id(profile_id)
        if profile is None:
            raise CompanyProfileNotFoundError(str(profile_id))
        return profile


def _apply(profile: CompanyProfile, data: CompanyProfileData) -> None:
    """Vuelca los datos editables sobre la entidad (sin tocar métricas)."""
    profile.name = data.name
    profile.logo_url = data.logo_url
    profile.category = data.category
    profile.description = data.description
    profile.address = data.address
    profile.city = data.city
    profile.latitude = data.latitude
    profile.longitude = data.longitude
    profile.capacity = data.capacity
    profile.opening_hours = data.opening_hours
