"""Casos de uso del módulo lead: armar y seguir la lista de comercios a captar."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from uuid import UUID

from app.modules.lead.domain.entities import ImportResult, Lead, PlaceSnapshot
from app.modules.lead.domain.exceptions import (
    LeadNotFoundError,
    PlaceSnapshotMissingError,
    PlaceSourcePartialError,
    PlaceSourceUnavailableError,
    UnknownBarrioError,
)
from app.modules.lead.domain.repositories import (
    LeadRepository,
    PlaceSnapshotRepository,
    PlaceSource,
)
from app.modules.lead.domain.snapshots import next_refresh
from app.modules.lead.domain.value_objects import BARRIOS_CABA, LeadStatus


class LeadService:
    """Lista de captación de comercios para la beta (solo admin).

    Los comercios salen de OpenStreetMap (datos abiertos, ODbL) y no de
    scrapear Google Maps: ver ADR-0019. Desde el ADR-0029 no se consulta
    OSM en vivo: se importa desde la copia semanal del barrio
    (`PlaceSnapshotService`).
    """

    def __init__(self, leads: LeadRepository, snapshots: PlaceSnapshotRepository) -> None:
        self._leads = leads
        self._snapshots = snapshots

    async def import_barrio(self, barrio: str) -> ImportResult:
        """Suma a la lista los comercios gastronómicos de la copia del barrio.

        Idempotente: un comercio que ya estaba (misma referencia de OSM) se
        actualiza con los datos nuevos, sin perder su estado ni sus notas.
        Lanza `PlaceSnapshotMissingError` si el barrio todavía no tiene copia.
        """
        if barrio not in BARRIOS_CABA:
            raise UnknownBarrioError(barrio)

        snapshot = await self._snapshots.get(barrio)
        # Una copia con 0 comercios es una consulta que salió mal (ADR-0029):
        # se trata como si no hubiera copia, y la pantalla la vuelve a pedir.
        if snapshot is None or not snapshot.places:
            raise PlaceSnapshotMissingError(barrio)
        candidates = snapshot.places
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
            barrio=barrio,
            found=len(by_ref),
            created=created,
            updated=updated,
            fetched_at=snapshot.fetched_at,
        )

    async def snapshot_dates(self) -> dict[str, datetime]:
        """De cuándo es la copia de OSM de cada barrio que tiene una."""
        return await self._snapshots.fetched_at_by_barrio()

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


class PlaceSnapshotService:
    """Refresco de la copia semanal de OpenStreetMap, de a un barrio (ADR-0029).

    Lo maneja el chequeo del scheduler en proceso
    (`infrastructure/place_snapshot_job.py`), que decide cuándo llamar y
    guarda en memoria qué barrios pidió la pantalla y cuáles fallaron hace
    poco.
    """

    def __init__(self, snapshots: PlaceSnapshotRepository, places: PlaceSource) -> None:
        self._snapshots = snapshots
        self._places = places

    async def plan(
        self,
        now: datetime,
        *,
        requested: Sequence[str] = (),
        resting_until: Mapping[str, datetime] | None = None,
    ) -> tuple[str | None, datetime | None]:
        """El barrio a refrescar ahora, o cuándo vence la próxima copia."""
        fetched = await self._snapshots.fetched_at_by_barrio()
        return next_refresh(
            fetched, now, requested=requested, resting_until=resting_until
        )

    async def refresh(self, barrio: str, now: datetime) -> int:
        """Baja el barrio de la fuente y reemplaza su copia. Devuelve cuántos
        comercios quedaron.

        Primero la consulta (que puede tardar minutos) y después la base: así
        no se tiene una conexión tomada mientras se espera a Overpass. Si la
        consulta falla, lanza `PlaceSourceUnavailableError` y la copia
        anterior queda como estaba. Una respuesta con 0 comercios es siempre
        falla (Overpass a veces responde vacío cuando corta la consulta o le
        faltan las áreas), nunca un barrio que se quedó sin bares. Una
        respuesta parcial (`PlaceSourcePartialError`)
        nunca pisa una copia existente: cuenta como falla. Sólo se guarda si
        el barrio no tenía ninguna y trae comercios, porque algo es mejor que
        nada.
        """
        if barrio not in BARRIOS_CABA:
            raise UnknownBarrioError(barrio)
        try:
            candidates = await self._places.find_gastronomy(barrio)
        except PlaceSourcePartialError as exc:
            # Sólo se protege una copia con comercios: una vacía (las que
            # quedaron el 2026-11-22) cuenta como faltante y la parcial gana.
            previous = await self._snapshots.get(barrio)
            if previous is not None and previous.places:
                raise
            candidates = exc.candidates
        # 0 comercios nunca es éxito: en la Ciudad no hay barrio sin bares ni
        # cafés en OSM, así que es una consulta que salió mal (2026-11-22:
        # Almagro y otros quedaron con copias vacías por 7 días). Falla y se
        # reintenta con el backoff del refresco.
        if not candidates:
            raise PlaceSourceUnavailableError(f"0 comercios en {barrio}: sospechoso")
        # La misma referencia puede venir repetida; gana la última.
        by_ref = {c.osm_ref: c for c in candidates}
        await self._snapshots.replace(
            PlaceSnapshot(barrio=barrio, fetched_at=now, places=tuple(by_ref.values()))
        )
        return len(by_ref)
