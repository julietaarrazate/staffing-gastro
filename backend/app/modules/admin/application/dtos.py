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

    # `shift_assignment_rate` (antes `shift_fill_rate`, renombrada — ver
    # docs/audits/ETAPA1_QUALITY_REVIEW.md §1.1): turnos que alguna vez
    # tuvieron un candidato asignado (`first_assigned_at`), sin importar
    # qué pasó después. Un turno asignado→no-show→cancelado CUENTA acá —
    # mide "el matching encontró a alguien", no "terminó cubierto".
    shift_assignment_rate_sample_size: int
    shift_assignment_rate_pct: float | None

    # Complementaria a la de arriba: turnos cuyo estado ACTUAL es
    # `FINALIZADO`/`PAGADO` (Shift.finish()/mark_paid(), estados ya
    # existentes del dominio) — cobertura real de punta a punta. La brecha
    # entre esta tasa y `shift_assignment_rate_pct` es la señal útil:
    # cuánto de lo "encontrado" efectivamente se trabajó.
    shift_completion_rate_sample_size: int
    shift_completion_rate_pct: float | None

    application_acceptance_sample_size: int
    application_to_acceptance_rate_pct: float | None

    no_show_sample_size: int
    no_show_rate_pct: float | None

    # OJO al leer: NO es "% de trabajadores que vuelven a usar Oído"
    # (retención/login) — mide, entre los trabajadores que alguna vez
    # COMPLETARON un turno (ciclo entero: confirmar→check-in→check-out→
    # finalizar), qué % completó un segundo. Un trabajador que se postuló
    # 10 veces y nunca fue elegido NO entra en el denominador (no cuenta
    # como "no repite": queda directamente afuera de la muestra). Ver
    # docs/audits/ETAPA1_QUALITY_REVIEW.md §1.4 para la definición completa
    # y por qué se renombró desde `worker_repeat_rate`.
    worker_completion_repeat_sample_size: int
    worker_completion_repeat_rate_pct: float | None

    # Más cercana a "recurrencia de uso" que la de arriba: `events_published`
    # se incrementa en CADA publicación (no requiere que el turno se cubra),
    # así que el denominador es "comercios que publicaron >=1 vez" — más
    # inclusivo que el de trabajadores. Igual sin ventana temporal (all-time).
    employer_repeat_sample_size: int
    employer_repeat_rate_pct: float | None
