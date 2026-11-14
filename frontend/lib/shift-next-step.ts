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
  /** Qué está pasando, en una línea, en el idioma del comercio. Vacío
   *  cuando el chip de estado ya lo dice todo. */
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
  // Sin línea (2026-09-28, diagnóstico de sobrecarga): "Buscando gente cerca
  // tuyo" repetía el chip "Publicado" y el encabezado "Buscando personal" de
  // la misma familia. La acción ("Elegir a alguien") ya dice qué sigue.
  publicado: {
    hint: "",
    action: "candidates",
    actionLabel: "Elegir a alguien",
  },
  buscando_personal: {
    hint: "",
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
  // Sin línea: el chip "Cancelado" y el stepper ("Cancelado en el paso 1 de
  // 4") ya lo dicen.
  cancelado: { hint: "", action: null },
  // ADR-0015: nadie decidió esto (a diferencia de "cancelado"), así que el
  // hint lo dice distinto — y sin acción, porque lo que sigue es publicar un
  // turno NUEVO, no algo que se haga sobre éste.
  no_cubierto: { hint: "No se cubrió a tiempo.", action: null },
};

/** Largo máximo del nombre en la línea: un nombre larguísimo no tiene que
 *  romper la tarjeta de 390 px. */
const MAX_NAME_CHARS = 18;

/**
 * Primer nombre listo para una línea ("Ana María Pérez" → "Ana"). Devuelve
 * `null` cuando no hay nombre usable (vacío, sólo espacios, no es texto), y la
 * línea cae a su versión sin nombre. Corta con «…» lo larguísimo.
 */
export function firstNameOf(fullName: string | null | undefined): string | null {
  if (typeof fullName !== "string") return null;
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (!first) return null;
  const chars = Array.from(first);
  return chars.length > MAX_NAME_CHARS ? `${chars.slice(0, MAX_NAME_CHARS).join("")}…` : first;
}

/** Línea de "qué pasa" por estado, con el nombre de la persona cuando se
 *  sabe ("Ana va en camino al local.") y sin él cuando no ("Va en camino…"). */
function hintWithWorker(status: ShiftStatus, name: string | null): string | null {
  switch (status) {
    case "asignado":
      return name
        ? `Asignado a ${name}. Esperando que confirme su asistencia.`
        : "Esperando que confirme su asistencia.";
    case "confirmado":
      return name
        ? `${name} confirmó. Te avisamos cuando salga para allá.`
        : "Confirmó. Te avisamos cuando salga para allá.";
    case "en_camino":
      return name ? `${name} va en camino al local.` : "Va en camino al local.";
    case "check_in":
      return name ? `${name} llegó al local.` : "Llegó al local.";
    case "trabajando":
      return name ? `${name} está trabajando ahora.` : "Trabajando ahora.";
    case "check_out":
      return name ? `${name} terminó de trabajar.` : "Terminó de trabajar.";
    default:
      return null;
  }
}

/** «Elegir a alguien» con cuántas personas se postularon: «(2)». Con una sola
 *  queda «(1)» — misma forma siempre, para que el botón no cambie de frase
 *  según la cifra. Con cero (o sin dato) va sin cifra. */
function candidatesLabel(count: number | null | undefined): string {
  return typeof count === "number" && count > 0 ? `Elegir a alguien (${count})` : "Elegir a alguien";
}

export function nextStepFor(shift: Shift): NextStep {
  const base = NEXT_STEP[shift.status] ?? { hint: "", action: null };
  const hint = hintWithWorker(shift.status, firstNameOf(shift.worker_name));
  if (base.action === "candidates") {
    return { ...base, actionLabel: candidatesLabel(shift.pending_applicants_count) };
  }
  return hint === null ? base : { ...base, hint };
}
