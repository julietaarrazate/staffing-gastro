"""Entidad de dominio Usuario.

Representa al usuario de forma pura, sin acoplarse a SQLAlchemy ni a FastAPI.
La persistencia se hace mediante un mapeo en la capa de infraestructura.
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from app.modules.identity.domain.value_objects import UserRole, UserStatus


@dataclass
class User:
    """Raíz de agregado Usuario."""

    email: str
    hashed_password: str
    role: UserRole
    full_name: str
    id: UUID = field(default_factory=uuid4)
    status: UserStatus = UserStatus.ACTIVE
    is_verified: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE

    def verify(self) -> None:
        """Marca el usuario como verificado (estado de verificación del spec)."""
        self.is_verified = True

    def suspend(self) -> None:
        self.status = UserStatus.SUSPENDED

    def activate(self) -> None:
        self.status = UserStatus.ACTIVE

    def promote_to_admin(self) -> None:
        self.role = UserRole.ADMIN
