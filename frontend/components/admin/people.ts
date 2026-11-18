// Etiquetas de "Personas" en el panel de admin (lista y ficha).

import type { SuspensionPreview } from "@/lib/types";

export const ROLE_LABELS: Record<string, string> = {
  worker: "Trabajador",
  employer: "Comercio",
  admin: "Admin",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  deleted: "Eliminado",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
};

/** Qué les pasa a sus turnos si se confirma la suspensión (ADR-0024), en
 * frases para el diálogo de «Suspender». Sin turnos tocados, una sola frase
 * que lo dice: la admin sabe que se miró y dio cero. */
export function suspensionImpactLines(preview: SuspensionPreview): string[] {
  const { hidden, cancelled, reopened } = preview;
  const lines: string[] = [];
  if (hidden > 0) {
    lines.push(
      hidden === 1
        ? "Se oculta 1 turno abierto: nadie lo ve ni se postula. Si la reactivás, vuelve a verse."
        : `Se ocultan ${hidden} turnos abiertos: nadie los ve ni se postula. Si la reactivás, vuelven a verse.`
    );
  }
  if (cancelled > 0) {
    lines.push(
      cancelled === 1
        ? "Se cancela 1 turno con alguien asignado o confirmado. Le avisamos a esa persona, sin penalidad para nadie."
        : `Se cancelan ${cancelled} turnos con alguien asignado o confirmado. Le avisamos a cada persona, sin penalidad para nadie.`
    );
  }
  if (reopened > 0) {
    lines.push(
      reopened === 1
        ? "1 turno suyo vuelve a buscar personal. Le avisamos al comercio, sin sumarle una cancelación."
        : `${reopened} turnos suyos vuelven a buscar personal. Le avisamos a cada comercio, sin sumarle una cancelación.`
    );
  }
  if (lines.length === 0) lines.push("No tiene turnos por cubrir: no se toca ninguno.");
  return lines;
}
