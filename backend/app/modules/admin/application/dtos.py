"""DTOs del módulo de administración."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.modules.identity.domain.value_objects import UserRole, UserStatus


@dataclass
class AdminUserRow:
    """Fila de la lista de usuarios del panel de administración.

    Espejo de `User` (identity) más `photo_url`, resuelta por puerto desde
    el módulo de trabajador o comercio según el rol (misma idea que
    `VerificationService.verified_user_ids`) — el dominio `User` no carga
    ese dato porque no le pertenece."""

    id: UUID
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    is_verified: bool
    created_at: datetime | None
    photo_url: str | None


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

    # Métricas de producto (docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md
    # §6): todas derivadas de columnas ya existentes, `None` sin muestra (0
    # denominador) — nunca un `%` silencioso sobre cero casos.
    shift_fill_rate_sample_size: int
    shift_fill_rate_pct: float | None

    application_acceptance_sample_size: int
    application_to_acceptance_rate_pct: float | None

    no_show_sample_size: int
    no_show_rate_pct: float | None

    worker_repeat_sample_size: int
    worker_repeat_rate_pct: float | None

    employer_repeat_sample_size: int
    employer_repeat_rate_pct: float | None
