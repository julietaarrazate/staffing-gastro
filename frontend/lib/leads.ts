/**
 * Ayudas puras de la lista de comercios a captar (`/admin/leads`, ADR-0019):
 * etiquetas, links y exportación a CSV.
 */
import type { Lead, LeadKind, LeadStatus } from "./types";
import { normalizeUserLink, safeHttpsUrl } from "./safe-url";

export const LEAD_STATUSES: LeadStatus[] = [
  "nuevo",
  "contactado",
  "visitado",
  "interesado",
  "alta",
  "descartado",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  visitado: "Visitado",
  interesado: "Interesado",
  alta: "Dado de alta",
  descartado: "Descartado",
};

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  restaurante: "Restaurante",
  bar: "Bar",
  cafe: "Café",
  comida_rapida: "Comida rápida",
  heladeria: "Heladería",
};

/** Prioridad (0 a 5, calculada en el backend) en palabras. */
export function priorityLabel(priority: number): "Alta" | "Media" | "Baja" {
  if (priority >= 4) return "Alta";
  if (priority === 3) return "Media";
  return "Baja";
}

/** Link seguro a la web del comercio, o null si no sirve. */
export function websiteHref(website: string | null): string | null {
  return website ? safeHttpsUrl(normalizeUserLink(website)) : null;
}

/** Link a Instagram: acepta una URL o un usuario suelto ("@bar" o "bar"). */
export function instagramHref(instagram: string | null): string | null {
  if (!instagram) return null;
  const value = instagram.trim();
  if (/instagram\.com/i.test(value)) return safeHttpsUrl(normalizeUserLink(value));
  const handle = value.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

/** Abre el punto en Google Maps (un link, no scraping) para ver fotos y reseñas. */
export function mapsHref(lead: Pick<Lead, "latitude" | "longitude" | "name">): string {
  const query = encodeURIComponent(`${lead.name} ${lead.latitude},${lead.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Ficha del comercio en OpenStreetMap ("node/123" → su página). */
export function osmHref(osmRef: string): string {
  return `https://www.openstreetmap.org/${osmRef}`;
}

const CSV_COLUMNS: { header: string; value: (lead: Lead) => string }[] = [
  { header: "Nombre", value: (l) => l.name },
  { header: "Rubro", value: (l) => LEAD_KIND_LABELS[l.kind] },
  { header: "Barrio", value: (l) => l.barrio },
  { header: "Dirección", value: (l) => l.address ?? "" },
  { header: "Teléfono", value: (l) => l.phone ?? "" },
  { header: "Email", value: (l) => l.email ?? "" },
  { header: "Web", value: (l) => l.website ?? "" },
  { header: "Instagram", value: (l) => l.instagram ?? "" },
  { header: "Prioridad", value: (l) => priorityLabel(l.priority) },
  { header: "Estado", value: (l) => LEAD_STATUS_LABELS[l.status] },
  { header: "Notas", value: (l) => l.notes },
];

function csvCell(value: string): string {
  // Una celda que empieza con = + - @ la ejecuta Excel como fórmula: se
  // neutraliza con una comilla simple (los datos vienen de un mapa público).
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV con BOM para que Excel abra bien los acentos. */
export function leadsToCsv(leads: Lead[]): string {
  const lines = [
    CSV_COLUMNS.map((c) => csvCell(c.header)).join(","),
    ...leads.map((lead) => CSV_COLUMNS.map((c) => csvCell(c.value(lead))).join(",")),
  ];
  return `﻿${lines.join("\n")}`;
}
