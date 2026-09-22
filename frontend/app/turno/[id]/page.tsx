import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { SKILL_LABELS, ShiftPublic } from "@/lib/types";
import { buildShiftSummary } from "@/lib/shift-share";
import ShiftDetail from "@/components/ShiftDetail";

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
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "staffya.com.ar";
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
    },
    twitter: {
      card: "summary",
      title,
      description,
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
