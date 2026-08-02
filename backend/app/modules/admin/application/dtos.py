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

    # Promesa central del negocio ("cubrir un puesto en menos de 10
    # minutos", PRODUCT.md): tiempo entre publicar un turno y encontrar el
    # primer candidato. `None` si todavía no hay muestra (sin backfill,
    # sólo cuenta turnos publicados después de la migración 0020).
    coverage_sample_size: int
    avg_time_to_fill_minutes: float | None
    pct_filled_under_10_min: float | None
