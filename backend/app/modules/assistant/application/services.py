"""Caso de uso del asistente general de IA del panel del comercio.

Sólo lecturas sobre `ShiftRepository` (puerto ya existente del módulo
shift) — mismo patrón de composición cross-módulo que `ShiftService` usa
para `matching`/`company`/etc.: se depende del PUERTO de otro dominio, nunca
de su servicio de aplicación. `consultar_turnos`/`ver_postulantes` no
necesitan una query nueva en el repositorio: alcanza con `list_by_company`
(ya paginado) filtrado en Python, dado el volumen chico de turnos por
comercio en esta etapa.
"""

from dataclasses import dataclass
from datetime import date, timezone
from uuid import UUID

from app.core.tz import ARG_TZ, hoy_art
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.repositories import ShiftRepository
from app.modules.shift.domain.value_objects import OPEN_STATUSES

# Tope de turnos considerados al resolver consultar_turnos/ver_postulantes.
# Un comercio de la beta no se acerca a este volumen; de sobrarse, es mejor
# señal de que hace falta un filtro server-side que fallar en silencio.
_LOOKUP_LIMIT = 200


@dataclass(frozen=True)
class ShiftsQueryResult:
    summary: str
    count: int
    tab: str


class AssistantService:
    def __init__(self, shifts: ShiftRepository) -> None:
        self._shifts = shifts

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

    def _matches_filter(self, shift: Shift, query_filter: str) -> bool:
        if query_filter == "hoy":
            return self._start_at_art_date(shift) == hoy_art()
        if query_filter == "urgentes":
            return shift.urgent and shift.status in OPEN_STATUSES
        if query_filter == "sin_cubrir":
            return shift.status in OPEN_STATUSES
        return True  # "todos"

    def _start_at_art_date(self, shift: Shift) -> date:
        dt = shift.start_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(ARG_TZ).date()

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
