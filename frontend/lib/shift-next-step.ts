import type { Shift, ShiftStatus } from "@/lib/types";

/**
 * Qué tiene que hacer el comercio AHORA con un turno, en una sola acción.
 *
 * El panel mostraba hasta 7 botones por tarjeta a la vez (chat, ver
 * trabajador, ver candidatos, compartir, duplicar, no se presentó, cancelar,
 * cerrar, marcar pagado) y el comercio tenía que deducir cuál correspondía a
 * esta altura del ciclo. Acá se define, por estado, la ÚNICA acción que
 * importa en ese momento + una línea de qué está pasando. Todo lo demás pasa
 * a secundario.
 *
 * `action: null` = no hay nada que hacer del lado del comercio: está la
 * pelota del trabajador (confirmar, viajar, hacer check-in) o el turno ya
 * terminó. Ahí sólo se explica en qué anda.
 */

export type PrimaryAction = "publish" | "candidates" | "finish" | "markPaid";

export interface NextStep {
  /** Qué está pasando, en una línea, en el idioma del comercio. */
  hint: string;
  /** La única acción destacada, si hay alguna que dependa del comercio. */
  action: PrimaryAction | null;
  actionLabel?: string;
}

const NEXT_STEP: Record<ShiftStatus, NextStep> = {
  borrador: {
    hint: "Todavía no lo ve nadie.",
    action: "publish",
    actionLabel: "Publicar turno",
  },
  publicado: {
    hint: "Buscando gente cerca tuyo.",
    action: "candidates",
    actionLabel: "Elegir a alguien",
  },
  buscando_personal: {
    hint: "Buscando gente cerca tuyo.",
    action: "candidates",
    actionLabel: "Elegir a alguien",
  },
  asignado: { hint: "Esperando que confirme su asistencia.", action: null },
  confirmado: { hint: "Confirmó. Te avisamos cuando salga para allá.", action: null },
  en_camino: { hint: "Va en camino al local.", action: null },
  check_in: { hint: "Llegó al local.", action: null },
  trabajando: { hint: "Trabajando ahora.", action: null },
  check_out: {
    hint: "Terminó de trabajar.",
    action: "finish",
    actionLabel: "Cerrar turno",
  },
  finalizado: {
    hint: "Falta registrar el pago.",
    action: "markPaid",
    actionLabel: "Marcar como pagado",
  },
  pagado: { hint: "Listo: trabajado y pagado.", action: null },
  cancelado: { hint: "Este turno se canceló.", action: null },
};

export function nextStepFor(shift: Shift): NextStep {
  return NEXT_STEP[shift.status] ?? { hint: "", action: null };
}
