"""Reglas de otorgamiento de insignias y niveles (ADR-0004).

Funciones puras de dominio, sin dependencias de framework ni de base de
datos: reciben un `WorkerProfile` (ya con sus métricas actualizadas) y
devuelven el conjunto de insignias / el nivel que le corresponden **hoy**.
No hay histéresis: se recalculan desde cero en cada evento relevante (al
finalizar un turno o al cancelar una asignación confirmada), así que un
trabajador puede perder una insignia o bajar de nivel si sus métricas ya no
alcanzan el umbral. Ver `docs/REPUTATION.md` y
`docs/adr/ADR-0004-cancelacion-trabajador-e-insignias.md` para el detalle de
cada regla y sus motivos.
"""

from app.modules.worker.domain.entities import WorkerProfile
from app.modules.worker.domain.value_objects import (
    GamificationLevel,
    WorkerBadge,
    WorkerSkill,
)

# Umbrales de cada insignia (ver ADR-0004 para la justificación de negocio).
_NUNCA_FALTO_MIN_EVENTOS = 3
_TOP_ROL_MIN_RATING = 4.5
_TOP_ROL_MIN_EVENTOS = 10
_EVENTOS_PREMIUM_MIN_EVENTOS = 20

# Umbrales de cada nivel: (events_completed mínimo, rating mínimo).
_NIVEL_PLATINO = (50, 4.5)
_NIVEL_ORO = (20, 4.0)
_NIVEL_PLATA = (5, 3.5)


def compute_badges(profile: WorkerProfile) -> set[WorkerBadge]:
    """Calcula el conjunto de insignias que le corresponden al perfil ahora.

    Reglas (ADR-0004, `nunca_falto` extendida por ADR-0007):
    - `nunca_falto`: 0 cancelaciones, 0 no-shows y al menos 3 eventos
      completados. Un no-show rompe la insignia igual que una cancelación
      (de hecho es una señal peor: ni siquiera avisó).
    - `top_mozo` / `top_bartender`: tiene el skill, `rating >= 4.5` y
      `events_completed >= 10`.
    - `eventos_premium`: `events_completed >= 20` — proxy honesto por volumen;
      hoy el dominio no distingue "eventos premium" de eventos regulares.
    - `perfil_verificado`: **no se calcula acá**. `is_verified` vive en
      `User` (módulo `identity`), no en `WorkerProfile`; incorporarlo
      forzaría acoplar este cálculo de dominio (puro, sin DB) a otro módulo.
      Queda fuera de la lógica automática, documentado en el ADR.
    """
    badges: set[WorkerBadge] = set()

    if (
        profile.cancellations == 0
        and profile.no_shows == 0
        and profile.events_completed >= _NUNCA_FALTO_MIN_EVENTOS
    ):
        badges.add(WorkerBadge.NUNCA_FALTO)

    if (
        WorkerSkill.MOZO in profile.skills
        and profile.rating >= _TOP_ROL_MIN_RATING
        and profile.events_completed >= _TOP_ROL_MIN_EVENTOS
    ):
        badges.add(WorkerBadge.TOP_MOZO)

    if (
        WorkerSkill.BARTENDER in profile.skills
        and profile.rating >= _TOP_ROL_MIN_RATING
        and profile.events_completed >= _TOP_ROL_MIN_EVENTOS
    ):
        badges.add(WorkerBadge.TOP_BARTENDER)

    if profile.events_completed >= _EVENTOS_PREMIUM_MIN_EVENTOS:
        badges.add(WorkerBadge.EVENTOS_PREMIUM)

    return badges


def compute_level(profile: WorkerProfile) -> GamificationLevel:
    """Calcula el nivel de gamificación por `events_completed` con piso de
    `rating` (ADR-0004), para evitar subir de nivel por volumen puro sin
    calidad. Sin histéresis: si no llega al piso de rating del nivel
    siguiente, se queda en el nivel anterior que sí cumple (recalculado
    desde cero, no es un nivel "ganado" que se conserva)."""
    min_events, min_rating = _NIVEL_PLATINO
    if profile.events_completed >= min_events and profile.rating >= min_rating:
        return GamificationLevel.PLATINO

    min_events, min_rating = _NIVEL_ORO
    if profile.events_completed >= min_events and profile.rating >= min_rating:
        return GamificationLevel.ORO

    min_events, min_rating = _NIVEL_PLATA
    if profile.events_completed >= min_events and profile.rating >= min_rating:
        return GamificationLevel.PLATA

    return GamificationLevel.BRONCE
