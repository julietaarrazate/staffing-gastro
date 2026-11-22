"""Comercios gastronómicos desde OpenStreetMap, vía la API pública de Overpass.

Por qué OpenStreetMap y no Google Maps: scrapear Maps va contra sus términos y
los datos de OSM tienen licencia abierta (ODbL), que sólo pide atribución
("© colaboradores de OpenStreetMap", la muestra la pantalla). Ver ADR-0019.

La consulta busca el barrio como límite administrativo (`admin_level=10`)
dentro de la Ciudad de Buenos Aires, para no confundir "Palermo" con la
ciudad de Italia.

Desde el ADR-0029 esto no corre con la admin esperando: lo usa el refresco
semanal de la copia por barrio (`place_snapshot_job.py`), en segundo plano.
Por eso consulta los servidores **de a uno, en serie**, con plazos largos y
reintentos con espera: los servidores públicos están saturados (desde Render
`overpass-api.de` rechaza la conexión y `maps.mail.ru` da 504) y pedirle lo
mismo a todos a la vez sólo suma carga. Overpass es un servicio comunitario:
un barrio por vez y nunca en un loop sin pausa.
"""

import asyncio
import logging
from collections.abc import Sequence

import httpx

from app.modules.lead.domain.entities import PlaceCandidate
from app.modules.lead.domain.exceptions import (
    PlaceSourcePartialError,
    PlaceSourceUnavailableError,
)
from app.modules.lead.domain.repositories import PlaceSource
from app.modules.lead.domain.value_objects import OSM_AMENITY_TO_KIND

logger = logging.getLogger(__name__)

# Servidores públicos de Overpass, en el orden en que se prueban. La consulta
# es la misma en todos.
OVERPASS_URLS: tuple[str, ...] = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
# Plazo de cada consulta a un servidor (total, no sólo de lectura).
_REQUEST_TIMEOUT_S = 180.0
# `[timeout:]` de la consulta: el servidor tiene que cortar antes que nosotros.
_QUERY_TIMEOUT_S = 170
# Conectar tiene que ser rápido: un servidor que no atiende se saltea.
_CONNECT_TIMEOUT_S = 15
# Espera antes de cada nueva vuelta por todos los servidores (3 vueltas).
_RETRY_WAITS_S: tuple[float, ...] = (60.0, 300.0)
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
        request_timeout_s: float = _REQUEST_TIMEOUT_S,
        retry_waits_s: Sequence[float] = _RETRY_WAITS_S,
    ) -> None:
        self._urls = urls
        # Sólo los tests pasan un transporte falso (sin red), plazos chicos y
        # esperas en cero.
        self._transport = transport
        self._request_timeout_s = request_timeout_s
        self._retry_waits_s = tuple(retry_waits_s)

    async def _fetch(self, client: httpx.AsyncClient, url: str, query: str, barrio: str) -> dict:
        """Una consulta a un servidor. Si falla, loguea y vuelve a lanzar."""
        try:
            # El plazo de httpx es por lectura: un servidor que manda de a
            # gotas lo estiraría sin fin. Este corta el pedido entero.
            res = await asyncio.wait_for(
                client.post(url, data={"data": query}), timeout=self._request_timeout_s
            )
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
                "lead.overpass_failed barrio=%s servidor=%s error=%s %s",
                barrio,
                httpx.URL(url).host,
                type(exc).__name__,
                str(exc)[:120],
                extra={"barrio": barrio, "url": url},
            )
            raise

    async def find_gastronomy(self, barrio: str) -> list[PlaceCandidate]:
        query = build_query(barrio)
        timeout = httpx.Timeout(self._request_timeout_s, connect=_CONNECT_TIMEOUT_S)
        last_error: Exception | None = None
        # Una respuesta con `remark` de error de ejecución trae comercios,
        # pero quizás no todos: se sigue probando y sólo se devuelve (como
        # `PlaceSourcePartialError`) si ningún servidor da una completa.
        partial: tuple[str, list[PlaceCandidate]] | None = None
        async with httpx.AsyncClient(
            timeout=timeout, headers={"User-Agent": _USER_AGENT}, transport=self._transport
        ) as client:
            for wait in (0.0, *self._retry_waits_s):
                if wait > 0:
                    await asyncio.sleep(wait)
                for url in self._urls:
                    try:
                        payload = await self._fetch(client, url, query, barrio)
                    except Exception as exc:
                        last_error = exc
                        continue
                    remark = payload.get("remark")
                    if isinstance(remark, str) and "runtime error" in remark.lower():
                        logger.warning(
                            "lead.overpass_partial barrio=%s servidor=%s %s",
                            barrio,
                            httpx.URL(url).host,
                            remark[:120],
                        )
                        if partial is None:
                            partial = (remark[:120], parse_elements(payload, barrio))
                        continue
                    return parse_elements(payload, barrio)
        if partial is not None:
            raise PlaceSourcePartialError(f"respuesta parcial: {partial[0]}", partial[1])
        raise PlaceSourceUnavailableError(str(last_error))
