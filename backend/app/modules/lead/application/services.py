"""Casos de uso del módulo lead: armar y seguir la lista de comercios a captar."""

from uuid import UUID

from app.modules.lead.domain.entities import ImportResult, Lead
from app.modules.lead.domain.exceptions import LeadNotFoundError, UnknownBarrioError
from app.modules.lead.domain.repositories import LeadRepository, PlaceSource
from app.modules.lead.domain.value_objects import BARRIOS_CABA, LeadStatus


class LeadService:
    """Lista de captación de comercios para la beta (solo admin).

    Los comercios salen de OpenStreetMap (datos abiertos, ODbL) y no de
    scrapear Google Maps: ver ADR-0019.
    """

    def __init__(self, leads: LeadRepository, places: PlaceSource) -> None:
        self._leads = leads
        self._places = places

    async def import_barrio(self, barrio: str) -> ImportResult:
        """Trae los comercios gastronómicos del barrio y los suma a la lista.

        Idempotente: un comercio que ya estaba (misma referencia de OSM) se
        actualiza con los datos nuevos, sin perder su estado ni sus notas.
        """
        if barrio not in BARRIOS_CABA:
            raise UnknownBarrioError(barrio)

        candidates = await self._places.find_gastronomy(barrio)
        # La misma referencia puede venir repetida; gana la última.
        by_ref = {c.osm_ref: c for c in candidates}
        existing = await self._leads.get_by_osm_refs(list(by_ref))

        to_save: list[Lead] = []
        created = updated = 0
        for ref, candidate in by_ref.items():
            current = existing.get(ref)
            if current is None:
                to_save.append(Lead.from_candidate(candidate))
                created += 1
            else:
                to_save.append(current.refreshed_from(candidate))
                updated += 1
        await self._leads.save_many(to_save)
        return ImportResult(
            barrio=barrio, found=len(by_ref), created=created, updated=updated
        )

    async def list_leads(
        self,
        *,
        status: LeadStatus | None = None,
        barrio: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Lead]:
        """Leads filtrados, primero los de más prioridad y después por nombre."""
        leads = await self._leads.find(status=status, barrio=barrio)
        leads.sort(key=lambda lead: (-lead.priority, lead.name.casefold()))
        return leads[offset : offset + limit]

    async def summary(self, *, barrio: str | None = None) -> dict[LeadStatus, int]:
        """Cuántos comercios hay en cada estado, con los estados en cero incluidos."""
        counts = await self._leads.count_by_status(barrio=barrio)
        return {status: counts.get(status, 0) for status in LeadStatus}

    async def update_follow_up(
        self,
        lead_id: UUID,
        *,
        status: LeadStatus | None = None,
        notes: str | None = None,
    ) -> Lead:
        """Cambia el estado o las notas de un lead."""
        lead = await self._leads.get_by_id(lead_id)
        if lead is None:
            raise LeadNotFoundError(str(lead_id))
        return await self._leads.update(lead.with_follow_up(status=status, notes=notes))
