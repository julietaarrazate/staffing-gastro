import { API_URL } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

/** Una entrada del mapa del sitio: la página pública de un turno abierto. */
export type EntradaTurno = { url: string; lastModified: string };

// La API puede estar dormida (cold start de Render): el mapa del sitio no
// espera más que esto y sale con las páginas fijas.
const ESPERA_MS = 5_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los turnos con página pública indexable (`GET /shifts/public-index`: abiertos,
 * sin empezar, sólo `id` y `published_at`), como entradas del mapa del sitio.
 * Nunca lanza: si el backend no responde, contesta mal o trae algo que no es
 * lo esperado, devuelve `[]` y el mapa sale igual con las páginas fijas.
 */
export async function turnosParaElMapa(
  pedir: typeof fetch = fetch,
): Promise<EntradaTurno[]> {
  try {
    const respuesta = await pedir(`${API_URL}/shifts/public-index`, {
      // Una hora, donde el caché de datos de Next escribe (`next start`,
      // Vercel). En Cloudflare no hay caché incremental de escritura: ahí lo
      // que evita llamar al backend en cada pedido es la copia de 10 minutos
      // del Worker (`cloudflare/sitemap-cache.mjs`).
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!respuesta.ok) return [];
    const datos: unknown = await respuesta.json();
    if (!Array.isArray(datos)) return [];
    const entradas: EntradaTurno[] = [];
    for (const d of datos) {
      const id = (d as { id?: unknown })?.id;
      const publicado = (d as { published_at?: unknown })?.published_at;
      if (typeof id !== "string" || !UUID_RE.test(id)) continue;
      const fecha = typeof publicado === "string" ? new Date(publicado) : null;
      if (!fecha || Number.isNaN(fecha.getTime())) continue;
      entradas.push({ url: `${SITE_URL}/turno/${id}`, lastModified: fecha.toISOString() });
    }
    return entradas;
  } catch {
    return [];
  }
}
