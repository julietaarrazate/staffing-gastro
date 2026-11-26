import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const BASE_URL = SITE_URL;

/**
 * Sitemap de las páginas públicas indexables. Sólo las estáticas de entrada y
 * legales: las páginas públicas de turno (`/turno/[id]`) son efímeras (sólo
 * existen mientras el turno está abierto a postulaciones) y no hay un
 * endpoint público que las liste, así que se descubren por los links
 * compartidos y su propio Open Graph, no por acá. `changeFrequency`/`priority`
 * son orientativos. Sin `lastModified`: poner la hora del pedido le decía
 * a Google que todo cambiaba todo el tiempo.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/terminos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
