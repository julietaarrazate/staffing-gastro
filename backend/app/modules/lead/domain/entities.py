"""Entidades del módulo lead: comercios gastronómicos a captar para la beta."""

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.modules.lead.domain.value_objects import LeadKind, LeadStatus

# Peso del rubro en la prioridad: restaurantes y bares son los que más turnos
# eventuales publican (mozos, bacha, barra); cafés y el resto, menos.
_KIND_WEIGHT: dict[LeadKind, int] = {
    LeadKind.RESTAURANTE: 3,
    LeadKind.BAR: 3,
    LeadKind.CAFE: 2,
    LeadKind.COMIDA_RAPIDA: 1,
    LeadKind.HELADERIA: 1,
}


@dataclass(frozen=True)
class PlaceCandidate:
    """Un comercio tal como lo devuelve la fuente pública (OpenStreetMap),
    antes de entrar a la lista de captación."""

    osm_ref: str
    name: str
    kind: LeadKind
    barrio: str
    latitude: float
    longitude: float
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    instagram: str | None = None
    email: str | None = None


@dataclass(frozen=True)
class Lead:
    """Comercio en la lista de captación, con el seguimiento del contacto.

    Los datos del comercio salen de OpenStreetMap y se refrescan al volver a
    importar el barrio; `status`, `notes` y `contacted_at` son del
    seguimiento y una importación nunca los pisa.
    """

    osm_ref: str
    name: str
    kind: LeadKind
    barrio: str
    latitude: float
    longitude: float
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    instagram: str | None = None
    email: str | None = None
    status: LeadStatus = LeadStatus.NUEVO
    notes: str = ""
    contacted_at: datetime | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def priority(self) -> int:
        """Prioridad simple para ordenar a quién ir primero (0 a 5).

        Rubro (1 a 3) + uno si hay un canal directo (teléfono o email) + uno
        si hay dónde mirarlo antes de ir (web o Instagram).
        """
        score = _KIND_WEIGHT[self.kind]
        if self.phone or self.email:
            score += 1
        if self.website or self.instagram:
            score += 1
        return score

    @classmethod
    def from_candidate(cls, candidate: PlaceCandidate) -> "Lead":
        return cls(
            osm_ref=candidate.osm_ref,
            name=candidate.name,
            kind=candidate.kind,
            barrio=candidate.barrio,
            latitude=candidate.latitude,
            longitude=candidate.longitude,
            address=candidate.address,
            phone=candidate.phone,
            website=candidate.website,
            instagram=candidate.instagram,
            email=candidate.email,
        )

    def refreshed_from(self, candidate: PlaceCandidate) -> "Lead":
        """Datos del comercio actualizados desde la fuente, sin tocar el
        seguimiento (estado, notas, fecha de contacto)."""
        return replace(
            self,
            name=candidate.name,
            kind=candidate.kind,
            barrio=candidate.barrio,
            latitude=candidate.latitude,
            longitude=candidate.longitude,
            address=candidate.address,
            phone=candidate.phone,
            website=candidate.website,
            instagram=candidate.instagram,
            email=candidate.email,
        )

    def with_follow_up(
        self, *, status: LeadStatus | None = None, notes: str | None = None
    ) -> "Lead":
        """Cambia el seguimiento. La primera vez que deja de estar NUEVO
        queda registrado cuándo se lo contactó."""
        new_status = status if status is not None else self.status
        contacted_at = self.contacted_at
        if contacted_at is None and new_status not in (
            LeadStatus.NUEVO,
            LeadStatus.DESCARTADO,
        ):
            contacted_at = datetime.now(timezone.utc)
        return replace(
            self,
            status=new_status,
            notes=notes if notes is not None else self.notes,
            contacted_at=contacted_at,
        )


@dataclass(frozen=True)
class ImportResult:
    """Resultado de importar un barrio: cuántos encontró la fuente y cuántos
    entraron nuevos o se actualizaron."""

    barrio: str
    found: int
    created: int
    updated: int
