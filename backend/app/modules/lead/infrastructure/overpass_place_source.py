"""Comercios gastronómicos desde OpenStreetMap, vía la API pública de Overpass.

Por qué OpenStreetMap y no Google Maps: scrapear Maps va contra sus términos y
los datos de OSM tienen licencia abierta (ODbL), que sólo pide atribución
("© colaboradores de OpenStreetMap", la muestra la pantalla). Ver ADR-0019.

La consulta busca el barrio como límite administrativo (`admin_level=10`)
dentro de la Ciudad de Buenos Aires, para no confundir "Palermo" con la
ciudad de Italia. Overpass es un servicio comunitario: una consulta por
importación, con timeout, y nunca en un loop.
"""

import logging

import httpx

from app.modules.lead.domain.entities import PlaceCandidate
from app.modules.lead.domain.exceptions import PlaceSourceUnavailableError
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.domain.value_objects import OSM_AMENITY_TO_KIND

logger = logging.getLogger(__name__)

# Servidores públicos de Overpass, en orden. En producción (Render) el
# principal rechazó la conexión ("All connection attempts failed",
# 2026-10-20): algunos servidores públicos cortan rangos de IP de nubes. Si
# uno no conecta, responde 429 (limitado) o falla con 5xx, se prueba el
# siguiente. La consulta es la misma en todos.
OVERPASS_URLS: tuple[str, ...] = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
_TIMEOUT_S = 90
# Conectar tiene que ser rápido: si un servidor no atiende, mejor pasar al
# siguiente que esperar los 90 s de la consulta.
_CONNECT_TIMEOUT_S = 10
_USER_AGENT = "Oido/1.0 (captacion de comercios; www.oido.com.ar)"


def build_query(barrio: str) -> str:
    """Consulta Overpass QL de los comercios gastronómicos con nombre del barrio."""
    amenities = "|".join(sorted(OSM_AMENITY_TO_KIND))
    safe = barrio.replace("\\", "").replace('"', "")
    return (
        f"[out:json][timeout:{_TIMEOUT_S - 10}];"
        'area["boundary"="administrative"]["admin_level"="4"]'
        '["name"="Ciudad Autónoma de Buenos Aires"]->.caba;'
        'rel(area.caba)["boundary"="administrative"]["admin_level"="10"]'
        f'["name"="{safe}"];'
        "map_to_area->.barrio;"
        f'nwr(area.barrio)["amenity"~"^({amenities})$"]["name"];'
        "out center tags;"
    )


def _first(tags: dict, *keys: str, max_len: int = 300) -> str | None:
    """El primer tag con valor, recortado al largo de su columna: en OSM un
    campo puede traer varios valores juntos ("tel1;tel2;tel3")."""
    for key in keys:
        value = (tags.get(key) or "").strip()
        if value:
            return value[:max_len]
    return None


def _address(tags: dict) -> str | None:
    street = _first(tags, "addr:street", max_len=170)
    number = _first(tags, "addr:housenumber", max_len=20)
    if street and number:
        return f"{street} {number}"
    return street


def parse_elements(payload: dict, barrio: str) -> list[PlaceCandidate]:
    """Pasa la respuesta de Overpass a candidatos. Descarta lo que no tiene
    nombre, coordenadas o un rubro conocido."""
    candidates: list[PlaceCandidate] = []
    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        name = _first(tags, "name", max_len=200)
        kind = OSM_AMENITY_TO_KIND.get(tags.get("amenity", ""))
        # Los nodos traen lat/lon; las vías y relaciones, un `center`.
        point = element if "lat" in element else element.get("center") or {}
        lat, lon = point.get("lat"), point.get("lon")
        if not name or kind is None or lat is None or lon is None:
            continue
        candidates.append(
            PlaceCandidate(
                osm_ref=f"{element['type']}/{element['id']}",
                name=name,
                kind=kind,
                barrio=barrio,
                latitude=float(lat),
                longitude=float(lon),
                address=_address(tags),
                phone=_first(tags, "phone", "contact:phone", max_len=60),
                website=_first(tags, "website", "contact:website"),
                instagram=_first(tags, "contact:instagram", "instagram"),
                email=_first(tags, "email", "contact:email", max_len=200),
            )
        )
    return candidates


def _retryable(exc: httpx.HTTPError) -> bool:
    """Errores en los que vale la pena probar otro servidor: no conecta,
    tarda demasiado, está limitado (429) o falla del lado del servidor (5xx)."""
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return isinstance(exc, (httpx.TransportError,))


class OverpassPlaceSource(PlaceSource):
    def __init__(
        self,
        urls: tuple[str, ...] = OVERPASS_URLS,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._urls = urls
        # Sólo los tests pasan un transporte falso (sin red).
        self._transport = transport

    async def find_gastronomy(self, barrio: str) -> list[PlaceCandidate]:
        query = build_query(barrio)
        timeout = httpx.Timeout(_TIMEOUT_S, connect=_CONNECT_TIMEOUT_S)
        last_error: Exception | None = None
        async with httpx.AsyncClient(
            timeout=timeout, headers={"User-Agent": _USER_AGENT}, transport=self._transport
        ) as client:
            for url in self._urls:
                try:
                    res = await client.post(url, data={"data": query})
                    res.raise_for_status()
                    payload = res.json()
                except httpx.HTTPError as exc:
                    last_error = exc
                    logger.warning(
                        "lead.overpass_failed",
                        extra={"barrio": barrio, "url": url, "error": type(exc).__name__},
                    )
                    if _retryable(exc):
                        continue
                    break
                except ValueError as exc:  # respuesta que no es JSON
                    last_error = exc
                    logger.warning(
                        "lead.overpass_bad_json", extra={"barrio": barrio, "url": url}
                    )
                    continue
                return parse_elements(payload, barrio)
        raise PlaceSourceUnavailableError(str(last_error))
