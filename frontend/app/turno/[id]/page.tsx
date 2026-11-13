import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SKILL_LABELS } from "@/lib/types";
import { buildShiftSummary } from "@/lib/shift-share";
import ShiftDetail from "@/components/ShiftDetail";
import { SITE_URL } from "@/lib/site";
import { cldOgImage } from "@/lib/cloudinary";
import { OG_IMAGE_URL } from "@/lib/og";
import { getTurnoPublico } from "@/lib/turno-publico";

/**
 * Página pública de un turno (sin autenticación) — pensada para compartirse
 * por WhatsApp/redes. Consume `GET /shifts/{id}/public`, que sólo devuelve
 * turnos abiertos a postulaciones (PUBLICADO o BUSCANDO_PERSONAL, con la hora
 * por delante) y con campos seguros (ni contacto del comercio, ni
 * postulantes, ver `backend/app/modules/shift/api/routes.py`).
 *
 * El servidor arma sólo esa vista pública (metadatos para la vista previa de
 * WhatsApp incluidos); si quien la abre tiene sesión, `ShiftDetail` completa
 * el resto del lado del cliente — ver ahí el porqué.
 *
 * Cuando no hay turno para mostrar hay dos pantallas, según `lib/turno-publico.ts`:
 * «Este turno ya no está disponible» (`not-found.tsx` de esta carpeta) y
 * «No encontramos esa página» (`app/not-found.tsx`). Quién corta cada una
 * está explicado en `layout.tsx`.
 */

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
  const turno = await getTurnoPublico(id);

  // Sin turno abierto, el título dice lo mismo que la pantalla y nada del
  // turno. Next les suma `noindex` por ser respuestas 404.
  if (turno.estado === "no_encontrado") {
    return { title: "Página no encontrada" };
  }
  if (turno.estado === "no_disponible") {
    return { title: "Este turno ya no está disponible" };
  }
  const { shift } = turno;

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
    // `absolute`: el título ya termina en "— Oído" (va igual a `og:title`), y
    // con la plantilla del layout salía "— Oído — Oído".
    title: { absolute: title },
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
  const turno = await getTurnoPublico(id);

  // Acá sólo llega «ya no disponible»: lo que no existe ya lo cortó el layout.
  // Este `notFound()` muestra el `not-found.tsx` de esta carpeta.
  if (turno.estado !== "abierto") {
    notFound();
  }

  return <ShiftDetail publicShift={turno.shift} />;
}
