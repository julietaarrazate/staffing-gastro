/**
 * Texto y acción de "compartir" de un turno (WhatsApp es el canal de
 * difusión real en gastronomía argentina, ver EKP/evolution/INTAKE.md).
 *
 * `ShareableShift` es un subconjunto de campos que tanto `Shift` (panel del
 * comercio) como `ShiftPublic` (vista pública) cumplen, así que sirve para
 * ambos sin acoplar este helper a uno de los dos tipos.
 */
import { SKILL_LABELS, WorkerSkill } from "@/lib/types";
import { formatShiftDate, formatShiftTime } from "@/lib/datetime";

export interface ShareableShift {
  position: WorkerSkill;
  start_at: string;
  end_at: string;
  city: string | null;
  pay_amount: string | number;
  company_name?: string | null;
}

/** Resumen del turno sin link: "Buscamos {puesto} para el {fecha} de {hora}
 * a {hora} en {comercio}, {ciudad}. Pago: ${monto}." Se reusa tal cual como
 * descripción OG de la página pública (`app/turno/[id]/page.tsx`). */
export function buildShiftSummary(shift: ShareableShift): string {
  const date = formatShiftDate(shift.start_at);
  const start = formatShiftTime(shift.start_at);
  const end = formatShiftTime(shift.end_at);
  const amount = Number(shift.pay_amount).toLocaleString("es-AR");
  const lugar = [shift.company_name, shift.city].filter(Boolean).join(", ");

  return (
    `Buscamos ${SKILL_LABELS[shift.position]} para el ${date} de ${start} a ${end}` +
    `${lugar ? ` en ${lugar}` : ""}. Pago: $${amount}.`
  );
}

/** Arma el texto de difusión: resumen + link a la vista pública. */
export function buildShiftShareText(shift: ShareableShift, publicUrl: string): string {
  return `${buildShiftSummary(shift)} Postulate acá: ${publicUrl}`;
}

/** Comparte el turno: Web Share API si está disponible (nativo en mobile),
 * con fallback a `wa.me` (WhatsApp Web/desktop). */
export function shareShift(shift: ShareableShift, publicUrl: string): void {
  const text = buildShiftShareText(shift, publicUrl);

  if (typeof navigator !== "undefined" && "share" in navigator) {
    navigator.share({ title: "Staffya", text, url: publicUrl }).catch(() => {
      // El usuario canceló el share sheet o el navegador lo rechazó: no hay
      // nada más que hacer, no es un error real.
    });
    return;
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}
