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
 * Orden de los postulantes de un turno: primero quien ya tiene turnos hechos
 * en Oído (la reputación es real, no autodeclarada), después por calificación,
 * puntualidad y cantidad de turnos; a igualdad, quien se postuló antes. Quien
 * tuvo el turno y lo dejó va siempre al final, tenga la reputación que tenga
 * (G4): se le puede volver a asignar, pero después de mirar a los demás.
 *
 * Existe para que el comercio decida en segundos (la promesa es cubrir en
 * menos de 10 minutos): antes la lista venía en orden de llegada y el mejor
 * postulante podía quedar tercero, abajo del pliegue.
 */
export function rankApplicants(applicants: Applicant[]): Applicant[] {
  return [...applicants].sort((a, b) => {
    const unassigned = Number(isUnassigned(a)) - Number(isUnassigned(b));
    if (unassigned !== 0) return unassigned;
    const history = Number(b.events_completed > 0) - Number(a.events_completed > 0);
    if (history !== 0) return history;
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.punctuality_rate !== a.punctuality_rate) return b.punctuality_rate - a.punctuality_rate;
    if (b.events_completed !== a.events_completed) return b.events_completed - a.events_completed;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

/** ¿Hay un postulante que se pueda destacar con fundamento? Sólo si tiene
 *  turnos hechos: destacar a alguien sin historial sería inventar una razón.
 *  Nunca a quien ya tuvo este turno y lo dejó. */
export function standoutApplicant(ranked: Applicant[]): Applicant | null {
  const first = ranked[0];
  return first && !isUnassigned(first) && first.events_completed > 0 ? first : null;
}
