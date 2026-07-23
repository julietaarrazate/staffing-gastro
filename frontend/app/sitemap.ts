import type { MetadataRoute } from "next";

const BASE_URL = "https://staffya.com.ar";

/**
 * Sitemap de las páginas públicas indexables. Sólo las estáticas de entrada y
 * legales: las páginas públicas de turno (`/turno/[id]`) son efímeras (sólo
 * existen mientras el turno está PUBLICADO) y no hay un endpoint público que
 * las liste, así que se descubren por los links compartidos y su propio
 * Open Graph, no por acá. `changeFrequency`/`priority` son orientativos.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
