import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { turnosParaElMapa } from "@/lib/sitemap-turnos";

const BASE_URL = SITE_URL;

// Se arma en cada pedido y no en el build: los turnos abiertos cambian todo el
// día, y una página prerenderizada quedaría congelada con los del deploy. Esto
// anula el `revalidate` de la página, así que en Cloudflare la respuesta se
// guarda 10 minutos en la Cache API del Worker (`cloudflare/sitemap-cache.mjs`).
export const dynamic = "force-dynamic";

/**
 * Sitemap de las páginas públicas indexables: las fijas (entrada y legales) más
 * las de los turnos abiertos hoy (`/turno/[id]`, con `lastModified` = cuándo se
 * publicó), que pide `GET /shifts/public-index` (`lib/sitemap-turnos.ts`). Si el
 * backend no responde, sale igual sólo con las fijas: nunca un error.
 * `changeFrequency`/`priority` son orientativos. Las fijas van sin
 * `lastModified`: poner la hora del pedido le decía a Google que todo cambiaba
 * todo el tiempo.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/terminos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
  const turnos = await turnosParaElMapa();
  return [...fijas, ...turnos.map((t) => ({ ...t, priority: 0.6 }))];
}
