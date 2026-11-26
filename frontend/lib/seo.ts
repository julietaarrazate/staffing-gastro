import { SKILL_LABELS, type ShiftPublic } from "@/lib/types";
import { buildShiftSummary } from "@/lib/shift-share";

/**
 * Datos estructurados para buscadores y asistentes (etapa 6, SEO y GEO).
 *
 * `jobPostingDe`: la página pública de un turno como oferta de trabajo
 * (schema.org `JobPosting`, lo que lee Google for Jobs). Sale sólo de lo que
 * la vista pública ya muestra: ni la dirección exacta ni la descripción libre
 * del comercio.
 *
 * Quien contrata es el comercio (`hiringOrganization`), nunca Oído: Oído es
 * el sitio donde está publicada. Sin el nombre del comercio o sin la fecha de
 * publicación no se emite nada: son datos que Google exige, y una oferta a
 * medias es peor que ninguna.
 */
export function jobPostingDe(shift: ShiftPublic, url: string): Record<string, unknown> | null {
  if (!shift.company_name || !shift.published_at) return null;

  const porHora = shift.hourly_pay_amount != null ? Number(shift.hourly_pay_amount) : null;
  const total = Number(shift.pay_amount);
  // El pago es por turno. Schema.org no tiene esa unidad: se informa por hora
  // (el reofrecido ya lo trae; si no, el total dividido por las horas).
  const horas = (new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime()) / 3_600_000;
  const valorHora =
    porHora ?? (Number.isFinite(total) && total > 0 && horas > 0 ? Math.round(total / horas) : null);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: SKILL_LABELS[shift.position],
    description: buildShiftSummary(shift),
    datePosted: shift.published_at,
    // Se puede postular hasta que empieza (un reofrecido, hasta que termina).
    validThrough: shift.hourly_pay_amount != null ? shift.end_at : shift.start_at,
    employmentType: "TEMPORARY",
    hiringOrganization: { "@type": "Organization", name: shift.company_name },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(shift.city ? { addressLocality: shift.city } : {}),
        addressRegion: "Ciudad Autónoma de Buenos Aires",
        addressCountry: "AR",
      },
    },
    ...(valorHora !== null
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: shift.currency || "ARS",
            value: { "@type": "QuantitativeValue", value: valorHora, unitText: "HOUR" },
          },
        }
      : {}),
    directApply: true,
    url,
    identifier: { "@type": "PropertyValue", name: "Oído", value: shift.id },
  };
}

/** El JSON de un `<script type="application/ld+json">`, con `<` escapado para
 *  que un texto (el nombre de un comercio) nunca pueda cerrar el `<script>`. */
export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}

