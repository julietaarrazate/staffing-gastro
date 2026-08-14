"""Caso de uso del asistente general de IA del panel del comercio.

Sólo lecturas sobre `ShiftRepository` (puerto ya existente del módulo
shift) — mismo patrón de composición cross-módulo que `ShiftService` usa
para `matching`/`company`/etc.: se depende del PUERTO de otro dominio, nunca
de su servicio de aplicación. `consultar_turnos`/`ver_postulantes` no
necesitan una query nueva en el repositorio: alcanza con `list_by_company`
(ya paginado) filtrado en Python, dado el volumen chico de turnos por
comercio en esta etapa.
"""

import logging
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timezone
from statistics import median
from uuid import UUID

from app.core.tz import ARG_TZ, hoy_art
from app.modules.application.domain.entities import ApplicantMatch
from app.modules.application.domain.repositories import ShiftApplicationRepository
from app.modules.assistant.domain.entities import AssistantQueryLogEntry
from app.modules.assistant.domain.repositories import AssistantQueryLogRepository
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import OPEN_STATUSES

logger = logging.getLogger(__name__)

# Tope de turnos considerados al resolver consultar_turnos/ver_postulantes.
# Un comercio de la beta no se acerca a este volumen; de sobrarse, es mejor
# señal de que hace falta un filtro server-side que fallar en silencio.
_LOOKUP_LIMIT = 200

# Con menos turnos previos que esto, no hay señal real de "lo habitual" —
# mejor no mandarle nada a Gemini que arriesgar un contexto armado con un
# solo dato suelto (P2, auditoría de producto: "la IA tiene que aprender
# cosas de cada persona, está muy genérica, no hace nada" — Julieta eligió
# alcance chico, contexto del propio comercio por sesión, sin memoria
# persistente nueva).
_MIN_SHIFTS_FOR_CONTEXT = 2


@dataclass(frozen=True)
class ShiftsQueryResult:
    summary: str
    count: int
    tab: str


class AssistantService:
    def __init__(
        self,
        shifts: ShiftRepository,
        applications: ShiftApplicationRepository,
        query_log: AssistantQueryLogRepository,
    ) -> None:
        self._shifts = shifts
        self._applications = applications
        self._query_log = query_log

    async def log_query(self, company_id: UUID, text: str, intent: str) -> None:
        """Fire-and-forget: se llama al final de la resolución de la consulta,
        nunca antes (ver `api/routes.py`) — un fallo acá no debe tapar un
        resultado real ya calculado."""
        try:
            await self._query_log.add(
                AssistantQueryLogEntry(company_id=company_id, text=text, intent=intent)
            )
        except Exception:  # noqa: BLE001 — logging nunca puede romper la respuesta real
            logger.exception("No se pudo registrar la consulta del asistente")

    async def summarize_shifts(self, company_id: UUID, query_filter: str) -> ShiftsQueryResult:
        shifts = await self._shifts.list_by_company(company_id, limit=_LOOKUP_LIMIT)
        matched = [s for s in shifts if self._matches_filter(s, query_filter)]
        return ShiftsQueryResult(
            summary=self._summary_text(query_filter, len(matched)),
            count=len(matched),
            tab=_QUERY_FILTER_TAB.get(query_filter, "todos"),
        )

    async def find_shift_for_applicants(
        self, company_id: UUID, position: str | None, date_hint: str | None
    ) -> Shift | None:
        """Busca, entre los turnos del comercio, el que mejor matchea puesto +
        fecha aproximada. Sin disambiguación interactiva en esta primera
        versión: con más de un candidato, gana el publicado más reciente."""
        candidates = await self._shifts.list_by_company(company_id, limit=_LOOKUP_LIMIT)
        if position:
            candidates = [s for s in candidates if s.position.value == position]
        if not candidates:
            return None
        if date_hint:
            date_matches = [
                s for s in candidates if self._start_at_art_date(s).isoformat() == date_hint
            ]
            if date_matches:
                candidates = date_matches
        candidates.sort(key=lambda s: s.created_at or s.start_at, reverse=True)
        return candidates[0]

    async def find_applicant_by_name(
        self, company_id: UUID, name_query: str
    ) -> ApplicantMatch | None:
        """Delegación fina al puerto de `application` — el service de
        assistant no agrega lógica acá, sólo compone (mismo criterio del
        módulo: depender del PUERTO de otro dominio, nunca de su propio
        servicio de aplicación)."""
        return await self._applications.find_applicant_by_name(company_id, name_query)

    def _matches_filter(self, shift: Shift, query_filter: str) -> bool:
        if query_filter == "hoy":
            return self._start_at_art_date(shift) == hoy_art()
        if query_filter == "urgentes":
            return shift.urgent and shift.status in OPEN_STATUSES
        if query_filter == "sin_cubrir":
            return shift.status in OPEN_STATUSES
        return True  # "todos"

    def _start_at_art(self, shift: Shift) -> datetime:
        dt = shift.start_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(ARG_TZ)

    def _start_at_art_date(self, shift: Shift) -> date:
        return self._start_at_art(shift).date()

    async def build_context_summary(self, company_id: UUID) -> str | None:
        """Resumen en texto plano de "lo habitual" de ESTE comercio (puesto
        más pedido, horario típico, pago típico, si suele incluir propinas/
        comida) para que el asistente complete campos que el pedido no
        menciona explícitamente — nunca para contradecir lo que el texto sí
        dice (esa regla vive en el prompt, `_ASSISTANT_CONTEXT_INSTRUCTION`
        en `core/gemini.py`). Alcance chico a propósito (P2, elegido por
        Julieta): se recalcula en cada consulta a partir de los turnos ya
        publicados, sin memoria persistente nueva."""
        shifts = await self._shifts.list_by_company(company_id, limit=_LOOKUP_LIMIT)
        if len(shifts) < _MIN_SHIFTS_FOR_CONTEXT:
            return None

        positions = Counter(shift.position.value for shift in shifts)
        top_position, top_count = positions.most_common(1)[0]
        top_hour, _hour_count = Counter(self._start_at_art(s).hour for s in shifts).most_common(1)[0]
        typical_pay = median(float(shift.pay_amount) for shift in shifts)
        tips_share = sum(1 for shift in shifts if shift.tips) / len(shifts)
        meal_share = sum(1 for shift in shifts if shift.meal) / len(shifts)

        parts = [
            f'Publicó {len(shifts)} turnos antes. El puesto más pedido es "{top_position}" '
            f"({top_count} de {len(shifts)}).",
            f"Suele arrancarlos alrededor de las {top_hour:02d}:00hs.",
            f"El pago típico ronda ${typical_pay:,.0f}.".replace(",", "."),
        ]
        if tips_share >= 0.5:
            parts.append("Generalmente incluye propinas.")
        if meal_share >= 0.5:
            parts.append("Generalmente incluye comida de personal.")
        return " ".join(parts)

    def _summary_text(self, query_filter: str, count: int) -> str:
        plural = "s" if count != 1 else ""
        if query_filter == "hoy":
            return "No tenés turnos para hoy." if count == 0 else f"Tenés {count} turno{plural} para hoy."
        if query_filter == "urgentes":
            return (
                "No tenés turnos urgentes sin cubrir."
                if count == 0
                else f"Tenés {count} turno{plural} urgente{plural} sin cubrir."
            )
        if query_filter == "sin_cubrir":
            return (
                "No tenés turnos buscando personal ahora mismo."
                if count == 0
                else f"Tenés {count} turno{plural} buscando personal."
            )
        return "Todavía no publicaste ningún turno." if count == 0 else f"Tenés {count} turno{plural} en total."


_QUERY_FILTER_TAB = {
    "hoy": "todos",
    "urgentes": "buscando",
    "sin_cubrir": "buscando",
    "todos": "todos",
}
