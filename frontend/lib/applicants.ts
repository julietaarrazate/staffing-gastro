import type { Applicant, UnassignedReason } from "@/lib/types";

/** ¿Tuvo este turno asignado y lo dejó (rechazó, canceló o no se presentó)? */
export function isUnassigned(applicant: Pick<Applicant, "status">): boolean {
  return applicant.status === "desasignada";
}

const UNASSIGNED_LABELS: Record<UnassignedReason, string> = {
  rechazo: "Rechazó este turno",
  cancelacion: "Canceló",
  ausencia: "No se presentó",
};

/** La marca que ve el comercio en quien tuvo el turno y lo dejó, o `null`. */
export function unassignedLabel(applicant: Pick<Applicant, "status" | "motivo">): string | null {
  if (!isUnassigned(applicant)) return null;
  // Sin motivo conocido (no debería pasar) igual se marca, sin inventar cuál.
  return (applicant.motivo && UNASSIGNED_LABELS[applicant.motivo]) || "Ya tuvo este turno";
}

/** Postulantes en carrera: los que cuenta la pestaña (y el panel), sin
 *  quienes ya tuvieron el turno y lo dejaron. */
export function activeApplicantCount(applicants: Applicant[]): number {
  return applicants.filter((a) => !isUnassigned(a)).length;
}

/**
 * Por qué va primero quien encabeza la lista, o `null` si no hay un motivo
 * con respaldo. El orden lo decide el backend (ADR-0031: confianza del local,
 * sin faltas, experiencia en el puesto, cumplimiento, calificación); acá sólo
 * se nombra el motivo, con datos que llegan en la respuesta. Nunca para quien
 * ya tuvo este turno y lo dejó (va al final, con su marca).
 */
export function rotuloDelPrimero(applicants: Applicant[]): string | null {
  const first = applicants[0];
  if (!first || isUnassigned(first)) return null;
  if (first.es_favorito) return "Entre tus favoritos";
  if (first.trabajo_aca) return "Ya trabajó en tu local";
  if (first.events_completed > 0) {
    // «Mejor calificación» sólo si de verdad nadie en carrera la supera.
    const mejor = applicants.every(
      (a) => isUnassigned(a) || a.events_completed === 0 || a.rating <= first.rating,
    );
    if (mejor) return "Mejor calificación";
  }
  if (first.turnos_en_el_puesto > 0) return "Con experiencia en el puesto";
  return null;
}

/**
 * Lo que explica el lugar de una persona en la lista, para decirlo en su
 * fila (ADR-0031): la confianza del local y su experiencia en este puesto.
 * Son datos del comercio o que ya ve en la ficha. Quien tuvo el turno y lo
 * dejó no lleva motivos: lleva su marca.
 */
export function motivosDe(
  applicant: Pick<Applicant, "status" | "es_favorito" | "trabajo_aca" | "turnos_en_el_puesto">,
): string[] {
  if (isUnassigned(applicant)) return [];
  const motivos: string[] = [];
  if (applicant.es_favorito) motivos.push("Entre tus favoritos");
  if (applicant.trabajo_aca) motivos.push("Ya trabajó en tu local");
  if (applicant.turnos_en_el_puesto > 0) {
    const n = applicant.turnos_en_el_puesto;
    motivos.push(`${n} ${n === 1 ? "turno" : "turnos"} en este puesto`);
  }
  return motivos;
}

/** Carril urgente (ADR-0032): la marca de quien se ofreció para ya. */
export const PUEDE_IR_YA = "Puede ir ya";

/** El botón que elige a alguien: «Aceptar» si ya se ofreció para ya
 *  (el turno queda confirmado en el momento), «Elegir» si no. Con `nombre`,
 *  «Aceptar a <nombre>» / «Elegir a <nombre>». */
export function textoElegir(puedeIrYa: boolean | undefined, nombre?: string): string {
  const verbo = puedeIrYa ? "Aceptar" : "Elegir";
  return nombre ? `${verbo} a ${nombre}` : verbo;
}
