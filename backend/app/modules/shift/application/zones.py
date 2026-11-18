"""Desde dónde se mide un turno que no dice dónde es: el local del comercio.

La regla es de dominio (`shift.domain.nearby.zone_of`); acá está sólo el
paso de ir a buscar el local, que comparten los tres lugares que deciden qué
es «cerca» de un turno: el aviso a los trabajadores, los recomendados que ve
el comercio y el feed. Si cada uno lo resolviera por su cuenta, el aviso y la
lista podrían volver a contradecirse.
"""

from uuid import UUID

from app.modules.company.domain.entities import CompanyProfile
from app.modules.company.domain.repositories import CompanyProfileRepository
from app.modules.shift.domain.entities import Shift
from app.modules.shift.domain.nearby import Zone, zone_of


def _local(company: CompanyProfile | None) -> Zone | None:
    if company is None:
        return None
    return Zone(latitude=company.latitude, longitude=company.longitude, city=company.city)


async def measuring_zone(shift: Shift, companies: CompanyProfileRepository) -> Zone:
    """Zona del turno para medir «cerca»; el local del comercio si el turno
    no tiene ninguna. Sólo consulta el comercio cuando hace falta."""
    own = zone_of(shift)
    if own.is_known:
        return own
    return zone_of(shift, _local(await companies.get_by_id(shift.company_id)))


async def locals_of_unplaced(
    shifts: list[Shift], companies: CompanyProfileRepository
) -> dict[UUID, Zone]:
    """Local de cada comercio que tiene algún turno sin zona en `shifts`
    (por id de comercio), en una sola consulta. Vacío si todos tienen zona,
    que es lo normal: no agrega consultas al feed de todos los días."""
    company_ids = list({s.company_id for s in shifts if not zone_of(s).is_known})
    if not company_ids:
        return {}
    found = await companies.list_by_ids(company_ids)
    return {
        company_id: zone
        for company_id, company in found.items()
        if (zone := _local(company)) is not None
    }
