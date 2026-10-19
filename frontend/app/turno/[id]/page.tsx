import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { SKILL_LABELS, ShiftPublic } from "@/lib/types";
import { buildShiftSummary } from "@/lib/shift-share";
import ShiftDetail from "@/components/ShiftDetail";
import { SITE_URL } from "@/lib/site";
import { cldOgImage } from "@/lib/cloudinary";
import { OG_IMAGE_URL } from "@/lib/og";

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

// Un id que no es UUID no puede ser un turno: el backend responde 422 y la
// página daba 500 en vez de "no encontrado" (auditoría 2026-10-14).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `cache`: `generateMetadata` y la página piden el mismo turno; así sale un
// solo pedido al backend por visita.
const getPublicShift = cache(async (id: string): Promise<ShiftPublic | null> => {
  if (!UUID_RE.test(id)) return null;
  try {
    return await api.get<ShiftPublic>(`/shifts/${id}/public`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) return null;
    throw err;
  }
});

// La dirección canónica, fija: antes salía de los headers `x-forwarded-host`
// y `host` del pedido, que manda el cliente, y quedaba en `og:url`.
function getPublicUrl(id: string): string {
  return `${SITE_URL}/turno/${id}`;
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
  const url = getPublicUrl(id);
  // Con foto del local, la vista previa del link muestra el LUGAR (lo que
  // hace que alguien toque el link); sin foto, la imagen de marca de
  // `app/og/oido.jpg/route.ts`. Hay que nombrarla acá: el `openGraph` de esta
  // página reemplaza entero al del layout, y sin `images` el link de un
  // turno salía SIN imagen (pasaba desde siempre, visto el 2026-09-23).
  // Cuadrada para `og:image` (WhatsApp la muestra grande) y apaisada para X,
  // igual que la de marca — ver `lib/og-brand.tsx`.
  const cover = shift.company_cover_url;
  const ogImage = cover
    ? { url: cldOgImage(cover, 1200, 1200), width: 1200, height: 1200, alt: title }
    : { url: OG_IMAGE_URL, width: 1200, height: 1200, alt: title };
  const twitterImage = cover ? cldOgImage(cover, 1200, 630) : "/twitter-image";

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
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
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
