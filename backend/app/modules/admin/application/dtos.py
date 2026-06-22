"""DTOs del módulo de administración."""

from dataclasses import dataclass


@dataclass
class PlatformStats:
    """Métricas agregadas de la plataforma para el panel de administración."""

    total_users: int
    workers: int
    employers: int
    admins: int
    active: int
    suspended: int
    verified: int
