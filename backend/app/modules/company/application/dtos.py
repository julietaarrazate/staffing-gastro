"""DTOs de la capa de aplicación del módulo company."""

from dataclasses import dataclass

from app.modules.company.domain.value_objects import CompanyCategory


@dataclass
class CompanyProfileData:
    """Datos editables del perfil del comercio (alta y edición)."""

    name: str
    logo_url: str | None = None
    category: CompanyCategory | None = None
    description: str | None = None
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    capacity: int | None = None
    opening_hours: str | None = None
