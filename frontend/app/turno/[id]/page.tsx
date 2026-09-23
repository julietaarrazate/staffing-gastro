import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { SKILL_LABELS, ShiftPublic } from "@/lib/types";
import { buildShiftSummary } from "@/lib/shift-share";
import ShiftDetail from "@/components/ShiftDetail";
import { SITE_HOST } from "@/lib/site";
import { cldOgImage } from "@/lib/cloudinary";

/**
 * Página pública de un turno (sin autenticación) — pensada para compartirse
 * por WhatsApp/redes. Consume `GET /shifts/{id}/public`, que sólo devuelve
 * turnos en estado PUBLICADO con campos seguros (ni contacto del comercio,
 * ni postulantes, ver `backend/app/modules/shift/api/routes.py`).
 *
 * El servidor arma sólo esa vista pública (metadatos para la vista previa de
 * WhatsApp incluidos); si quien la abre tiene sesión, `ShiftDetail` completa
 * el resto del lado del cliente — ver ahí el porqué.
 */

async function getPublicShift(id: string): Promise<ShiftPublic | null> {
  try {
    return await api.get<ShiftPublic>(`/shifts/${id}/public`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function getPublicUrl(id: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? SITE_HOST;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/turno/${id}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shift = await getPublicShift(id);

  if (!shift) {
    return { title: "Turno no encontrado — Oído" };
  }

  const title = `Buscamos ${SKILL_LABELS[shift.position]}${
    shift.company_name ? ` en ${shift.company_name}` : ""
  } — Oído`;
  const description = buildShiftSummary(shift);
  const url = await getPublicUrl(id);
  // Con foto del local, la vista previa del link muestra el LUGAR (lo que
  // hace que alguien toque el link); sin foto, la imagen de marca de
  // `app/opengraph-image.tsx`. Hay que nombrarla acá: el `openGraph` de esta
  // página reemplaza entero al del layout, y sin `images` el link de un
  // turno salía SIN imagen (pasaba desde siempre, visto el 2026-09-23).
  const cover = shift.company_cover_url ? cldOgImage(shift.company_cover_url) : "/opengraph-image";
  const images = [{ url: cover, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Oído",
      locale: "es_AR",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function PublicShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shift = await getPublicShift(id);

  if (!shift) {
    notFound();
  }

  return <ShiftDetail publicShift={shift} />;
}
