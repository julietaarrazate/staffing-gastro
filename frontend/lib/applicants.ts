import type { Applicant } from "@/lib/types";

/**
 * Orden de los postulantes de un turno: primero quien ya tiene turnos hechos
 * en Oído (la reputación es real, no autodeclarada), después por calificación,
 * puntualidad y cantidad de turnos; a igualdad, quien se postuló antes.
 *
 * Existe para que el comercio decida en segundos (la promesa es cubrir en
 * menos de 10 minutos): antes la lista venía en orden de llegada y el mejor
 * postulante podía quedar tercero, abajo del pliegue.
 */
export function rankApplicants(applicants: Applicant[]): Applicant[] {
  return [...applicants].sort((a, b) => {
    const history = Number(b.events_completed > 0) - Number(a.events_completed > 0);
    if (history !== 0) return history;
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.punctuality_rate !== a.punctuality_rate) return b.punctuality_rate - a.punctuality_rate;
    if (b.events_completed !== a.events_completed) return b.events_completed - a.events_completed;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

/** ¿Hay un postulante que se pueda destacar con fundamento? Sólo si tiene
 *  turnos hechos: destacar a alguien sin historial sería inventar una razón. */
export function standoutApplicant(ranked: Applicant[]): Applicant | null {
  const first = ranked[0];
  return first && first.events_completed > 0 ? first : null;
}
