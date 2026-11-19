"""Comercios gastronómicos desde OpenStreetMap, vía la API pública de Overpass.

Por qué OpenStreetMap y no Google Maps: scrapear Maps va contra sus términos y
los datos de OSM tienen licencia abierta (ODbL), que sólo pide atribución
("© colaboradores de OpenStreetMap", la muestra la pantalla). Ver ADR-0019.

La consulta busca el barrio como límite administrativo (`admin_level=10`)
dentro de la Ciudad de Buenos Aires, para no confundir "Palermo" con la
ciudad de Italia. Overpass es un servicio comunitario: una consulta por
importación, con timeout, y nunca en un loop.
"""

import asyncio
import logging

import httpx

from app.modules.lead.domain.entities import PlaceCandidate
from app.modules.lead.domain.exceptions import PlaceSourceUnavailableError
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.domain.value_objects import OSM_AMENITY_TO_KIND

logger = logging.getLogger(__name__)

# Servidores públicos de Overpass. Se consultan todos a la vez y gana la
# primera respuesta válida. En producción (Render) algunos rechazan la
# conexión o se cuelgan (2026-10-20, 2026-11-19): probarlos de a uno sumaba
# minutos. La consulta es la misma en todos.
OVERPASS_URLS: tuple[str, ...] = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
# Plazo total de la búsqueda, con todos los servidores en paralelo. Tiene que
# quedar por debajo de los 100 s que espera el frontend y de los ~100 s a los
# que corta Cloudflare: pasado eso la admin ve un error y no se guarda nada.
_TOTAL_TIMEOUT_S = 80.0
# Margen entre el plazo total y el `[timeout:]` de la consulta: el servidor
# tiene que cortar antes de que cortemos nosotros.
_QUERY_TIMEOUT_S = 70
# Conectar tiene que ser rápido: un servidor que no atiende queda descartado
# sin esperar a los demás.
_CONNECT_TIMEOUT_S = 10
_USER_AGENT = "Oido/1.0 (captacion de comercios; www.oido.com.ar)"


def build_query(barrio: str) -> str:
    """Consulta Overpass QL de los comercios gastronómicos con nombre del barrio."""
    amenities = "|".join(sorted(OSM_AMENITY_TO_KIND))
    safe = barrio.replace("\\", "").replace('"', "")
    return (
        f"[out:json][timeout:{_QUERY_TIMEOUT_S}];"
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


class OverpassPlaceSource(PlaceSource):
    def __init__(
        self,
        urls: tuple[str, ...] = OVERPASS_URLS,
        transport: httpx.AsyncBaseTransport | None = None,
        total_timeout_s: float = _TOTAL_TIMEOUT_S,
    ) -> None:
        self._urls = urls
        # Sólo los tests pasan un transporte falso (sin red) y un plazo chico.
        self._transport = transport
        self._total_timeout_s = total_timeout_s

    async def _fetch(self, client: httpx.AsyncClient, url: str, query: str, barrio: str) -> dict:
        """Una consulta a un servidor. Si falla, loguea y vuelve a lanzar."""
        try:
            res = await client.post(url, data={"data": query})
            res.raise_for_status()
            payload = res.json()
            if not isinstance(payload, dict):
                raise ValueError("la respuesta no es un objeto JSON")
            # Overpass a veces responde 200 con un error de ejecución en
            # `remark` y sin elementos: no es una respuesta válida.
            remark = payload.get("remark")
            if (
                isinstance(remark, str)
                and "runtime error" in remark.lower()
                and not payload.get("elements")
            ):
                raise ValueError(f"error de ejecución: {remark[:100]}")
            return payload
        except Exception as exc:
            # El servidor y el error van en el mensaje: Render no muestra `extra`.
            logger.warning(
                "lead.overpass_failed servidor=%s error=%s %s",
                httpx.URL(url).host,
                type(exc).__name__,
                str(exc)[:120],
                extra={"barrio": barrio, "url": url},
            )
            raise

    async def find_gastronomy(self, barrio: str) -> list[PlaceCandidate]:
        query = build_query(barrio)
        # Cada pedido corta por su cuenta al llegar al plazo total.
        timeout = httpx.Timeout(self._total_timeout_s, connect=_CONNECT_TIMEOUT_S)
        last_error: Exception | None = None
        async with httpx.AsyncClient(
            timeout=timeout, headers={"User-Agent": _USER_AGENT}, transport=self._transport
        ) as client:
            tasks = {
                asyncio.ensure_future(self._fetch(client, url, query, barrio))
                for url in self._urls
            }
            loop = asyncio.get_running_loop()
            deadline = loop.time() + self._total_timeout_s
            try:
                pending = set(tasks)
                while pending:
                    remaining = deadline - loop.time()
                    if remaining <= 0:
                        break
                    done, pending = await asyncio.wait(
                        pending, timeout=remaining, return_when=asyncio.FIRST_COMPLETED
                    )
                    if not done:
                        break
                    for task in done:
                        if task.exception() is not None:
                            last_error = task.exception()
                        else:
                            return parse_elements(task.result(), barrio)
                if pending:
                    last_error = TimeoutError(
                        f"sin respuesta en {self._total_timeout_s:.0f} s"
                    )
                    logger.warning(
                        "lead.overpass_failed plazo agotado (%.0f s), sin respuesta de %d servidor(es)",
                        self._total_timeout_s,
                        len(pending),
                        extra={"barrio": barrio},
                    )
            finally:
                for task in tasks:
                    if not task.done():
                        task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
        raise PlaceSourceUnavailableError(str(last_error))
