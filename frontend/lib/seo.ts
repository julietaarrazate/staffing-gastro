import { SKILL_LABELS, type ShiftPublic } from "@/lib/types";
import { buildShiftSummary } from "@/lib/shift-share";
import { SITE_URL } from "@/lib/site";

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

  const positivo = (n: number) => (Number.isFinite(n) && n > 0 ? n : null);
  const porHora = shift.hourly_pay_amount != null ? positivo(Number(shift.hourly_pay_amount)) : null;
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
        // La zona es texto que escribe el comercio: no se le agrega una región
        // fija que podría no ser la suya.
        ...(shift.city ? { addressLocality: shift.city } : {}),
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
  };
}

/** El JSON de un `<script type="application/ld+json">`, con `<` escapado para
 *  que un texto (el nombre de un comercio) nunca pueda cerrar el `<script>`. */
export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}


/** Cómo se presenta Oído a buscadores y asistentes. Oído es un nexo
 *  tecnológico entre comercios y trabajadores: ni agencia de empleo ni
 *  empleador (mismo texto que `public/llms.txt`). */
const DESCRIPCION_OIDO =
  "Oído es una plataforma que conecta comercios gastronómicos con trabajadores para cubrir turnos en el día. " +
  "Es un nexo tecnológico: no es una agencia de empleo ni el empleador, cada turno lo acuerdan el comercio y la persona.";

/** `Organization` de la portada: quién es Oído. Sólo datos ya públicos del
 *  sitio (logo, la cuenta oficial de Instagram); sin teléfono ni dirección. */
export function organizacionOido(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oído",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: DESCRIPCION_OIDO,
    areaServed: { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
    // Las cuentas oficiales de la marca: con esto un buscador sabe que esa
    // cuenta y este sitio son lo mismo (Julieta, 2026-11-18). Si se suma otra
    // red, va acá.
    sameAs: ["https://www.instagram.com/oidoapp/"],
  };
}

/** `WebSite` de la portada: el nombre del sitio y su idioma. Sin
 *  `SearchAction`: la búsqueda de turnos es de la app, detrás de sesión. */
export function sitioWebOido(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Oído",
    url: SITE_URL,
    inLanguage: "es-AR",
    description: DESCRIPCION_OIDO,
    publisher: { "@type": "Organization", name: "Oído", url: SITE_URL },
  };
}
