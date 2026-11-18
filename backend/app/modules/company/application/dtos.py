"""DTOs de la capa de aplicación del módulo company."""

from dataclasses import dataclass
from enum import Enum

from app.modules.company.domain.value_objects import CompanyCategory


class _Unset(Enum):
    """Marca de "el pedido no mandó este campo" (distinto de mandarlo en null)."""

    UNSET = "unset"


UNSET = _Unset.UNSET


@dataclass
class CompanyProfileData:
    """Datos editables del perfil del comercio (alta y edición)."""

    name: str
    logo_url: str | None = None
    # Rubro, descripción, capacidad y horarios: UNSET = «el pedido no los trajo»
    # (actualización parcial, no se borran). null explícito sí los vacía.
    category: CompanyCategory | None | _Unset = UNSET
    description: str | None | _Unset = UNSET
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    capacity: int | None | _Unset = UNSET
    opening_hours: str | None | _Unset = UNSET
    # UNSET por default: la edición del perfil es parcial (lo que el pedido no
    # trae no se toca), y hay escritores que no conocen este campo (el onboarding de /bienvenida, la
    # siembra de fotos, y cualquier versión vieja de la PWA cacheada en un
    # celular). Si lo reemplazaran con None, borrarían la foto del local sin
    # que nadie lo pidiera. Sólo se toca cuando el pedido lo trae — incluido
    # null explícito, que sí es "sacar la foto".
    cover_photo_url: str | None | _Unset = UNSET
