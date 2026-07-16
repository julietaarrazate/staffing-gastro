/**
 * Cliente del geocoder GRATIS para el alta del comercio desde el mapa
 * (ADR-0006). Usamos **Nominatim** (OpenStreetMap) — nada de Google Places,
 * que cobra por búsqueda.
 *
 * Política de uso de Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
 * máximo 1 request/seg y "proper identification". Cómo lo respetamos:
 * - **Rate-limit real**: `lastRequestAt` fuerza un piso de
 *   `NOMINATIM_MIN_INTERVAL_MS` entre pedidos salientes, sin importar qué tan
 *   rápido tipee el comercio.
 * - **Debounce** de ~400ms en el componente (`MapAddressPicker`): no se
 *   dispara un pedido por tecla.
 * - **Identificación**: el navegador prohíbe setear el header `User-Agent`
 *   desde `fetch` ("forbidden header name" del fetch spec) — no es algo que
 *   podamos elegir desde acá. Lo que sí manda el browser automáticamente es
 *   el `Referer` (nuestro dominio), que es la vía que Nominatim documenta
 *   para identificar apps cliente sin backend propio de por medio. Si en el
 *   futuro esto no alcanza, la mitigación es proxyear la búsqueda por
 *   `backend/` (mismo dominio, ahí sí seteamos User-Agent) — no hace falta
 *   hoy, se deja anotado en `evolution`/backlog.
 * - **Sesgo a Argentina**: `countrycodes=ar` en la query.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MIN_QUERY_LENGTH = 3;

let lastRequestAt = 0;

export interface GeocodeResult {
  /** Texto corto para mostrar/editar (calle + altura + barrio, sin toda la jerarquía). */
  address: string;
  /** Ciudad/barrio/localidad detectado. */
  city: string;
  latitude: number;
  longitude: number;
}

/** Error de red o de disponibilidad del geocoder (no "sin resultados", que es un estado válido). */
export class GeocoderError extends Error {}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  state?: string;
}

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
}

function pickCity(address: NominatimAddress | undefined): string {
  if (!address) return "";
  return (
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.city_district ||
    address.county ||
    address.state ||
    ""
  );
}

/** `display_name` trae toda la jerarquía administrativa; nos quedamos con los
 * primeros segmentos (calle + altura + barrio/ciudad), más legible y editable. */
function shortAddress(displayName: string | undefined): string {
  if (!displayName) return "";
  return displayName
    .split(",")
    .slice(0, 3)
    .map((part) => part.trim())
    .join(", ");
}

/**
 * Busca direcciones en Argentina vía Nominatim. Devuelve `[]` si la query es
 * muy corta o si no hubo resultados (estado válido, no error). Lanza
 * `GeocoderError` ante fallas de red/disponibilidad — el llamador decide si
 * ofrece el fallback manual.
 */
export async function searchAddress(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "ar",
    "accept-language": "es",
    limit: "5",
    q: trimmed,
  });

  let response: Response;
  try {
    response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new GeocoderError("No pudimos conectarnos al buscador de direcciones.");
  }

  if (!response.ok) {
    throw new GeocoderError("El buscador de direcciones no está disponible en este momento.");
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GeocoderError("El buscador de direcciones devolvió una respuesta inválida.");
  }

  if (!Array.isArray(data)) return [];

  return (data as NominatimResult[])
    .filter((raw) => raw.lat != null && raw.lon != null)
    .map((raw) => ({
      address: shortAddress(raw.display_name),
      city: pickCity(raw.address),
      latitude: Number(raw.lat),
      longitude: Number(raw.lon),
    }));
}
