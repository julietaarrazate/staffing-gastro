import { formatShiftStartPhrase } from "@/lib/datetime";
import type { Shift, ShiftStatus } from "@/lib/types";
import { reofferedHint } from "@/lib/turno-reofrecido";

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

/** Margen para marcar la llegada sin que cuente como tarde (espejo de
 *  `PUNCTUALITY_TOLERANCE` del backend: 5 minutos). */
const MARGEN_PARA_MARCAR_MS = 5 * 60_000;

/**
 * Cómo llegó la persona, para decírselo al comercio (puntualidad real,
 * ADR-0008 act. 2026-11-26): «llegó a horario», «llegó 8 min tarde», o lo que
 * dijo el propio comercio si la llegada la marcó él. `null` si no hay dato o
 * si es el reemplazo de un turno ya empezado (no tiene hora pactada).
 */
export function llegadaDe(
  shift: Pick<Shift, "start_at" | "check_in_at" | "arrival_on_time" | "reoffered_at">,
): string | null {
  if (shift.arrival_on_time === true) return "llegó a horario";
  if (shift.arrival_on_time === false) return "llegó tarde";
  if (!shift.check_in_at || shift.reoffered_at) return null;
  const demora = new Date(shift.check_in_at).getTime() - new Date(shift.start_at).getTime();
  if (!Number.isFinite(demora)) return null;
  if (demora <= MARGEN_PARA_MARCAR_MS) return "llegó a horario";
  const minutos = Math.round(demora / 60_000);
  if (minutos < 60) return `llegó ${minutos} min tarde`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `llegó ${horas} h${resto ? ` ${resto} min` : ""} tarde`;
}

/** Con el turno confirmado, lo que se sabe de la reconfirmación (ADR-0031):
 *  contestó «Sí, voy», o se le preguntó y no contestó. */
type Reconfirmacion = "reconfirmo" | "sin_respuesta" | null;

function reconfirmacionDe(
  shift: Pick<Shift, "reconfirmed_at" | "no_reconfirm_alert_sent_at">,
): Reconfirmacion {
  if (shift.reconfirmed_at) return "reconfirmo";
  return shift.no_reconfirm_alert_sent_at ? "sin_respuesta" : null;
}

/** Línea de "qué pasa" por estado, con el nombre de la persona cuando se
 *  sabe ("Ana va en camino al local.") y sin él cuando no ("Va en camino…"). */
function hintWithWorker(
  status: ShiftStatus,
  name: string | null,
  reconfirmacion: Reconfirmacion = null,
  llegada: string | null = null,
): string | null {
  if (status === "confirmado" && reconfirmacion === "reconfirmo") {
    return name ? `${name} reconfirmó que va.` : "Reconfirmó que va.";
  }
  if (status === "confirmado" && reconfirmacion === "sin_respuesta") {
    return name
      ? `${name} no reconfirmó. Escribile para confirmarlo.`
      : "No reconfirmó. Escribile para confirmarlo.";
  }
  if (status === "check_in" && llegada) {
    return name ? `${name} ${llegada}.` : `${llegada.charAt(0).toUpperCase()}${llegada.slice(1)}.`;
  }
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

/**
 * Estado a efectos del texto: un turno `confirmado` con `en_route_at` ya está
 * en viaje (la persona tocó «salí» y comparte «va en camino»), aunque el
 * estado siga en `confirmado`. Cuando el viaje se apaga, `en_route_at` vuelve
 * a null y el texto vuelve solo a «Confirmó…». Único lugar que decide esto.
 */
export function effectiveStatus(shift: Pick<Shift, "status" | "en_route_at">): ShiftStatus {
  return shift.status === "confirmado" && shift.en_route_at ? "en_camino" : shift.status;
}

export function nextStepFor(shift: Shift): NextStep {
  const status = effectiveStatus(shift);
  const base = NEXT_STEP[status] ?? { hint: "", action: null };
  const hint = hintWithWorker(
    status,
    firstNameOf(shift.worker_name),
    reconfirmacionDe(shift),
    llegadaDe(shift),
  );
  if (base.action === "candidates") {
    return {
      ...base,
      // Turno reofrecido (U080): acá sí hace falta una línea, porque el chip
      // «Buscando personal» no dice que ya empezó ni hasta cuándo se ofrece.
      hint:
        shift.reoffered_at != null && shift.status === "buscando_personal"
          ? reofferedHint(shift)
          : base.hint,
      actionLabel: candidatesLabel(shift.pending_applicants_count),
    };
  }
  return hint === null ? base : { ...base, hint };
}

/**
 * Cierre automático (ADR-0008, decisión 24): un turno con la salida marcada
 * que el comercio no cierra lo cierra Oído solo a las 72 horas de la salida.
 * Espeja `AUTO_FINISH_DELAY` del backend (`shift/application/services.py`).
 */
export const AUTO_FINISH_AFTER_MS = 72 * 60 * 60_000;

/**
 * Cuándo se cierra solo un turno con la salida marcada, para una frase («el
 * viernes 20/11 a las 14:30»). `null` si no hay salida registrada o la hora ya
 * pasó (el cierre está por ocurrir: decir una hora pasada confundiría).
 */
export function autoFinishPhrase(
  checkOutIso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!checkOutIso) return null;
  const at = new Date(new Date(checkOutIso).getTime() + AUTO_FINISH_AFTER_MS);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return null;
  return formatShiftStartPhrase(at.toISOString(), now);
}

/**
 * La línea del trabajador mientras espera el cierre: que si el comercio no lo
 * cierra, lo cierra Oído a las 72 horas de su salida (con cuándo, si se sabe).
 */
export function autoFinishWorkerNote(
  checkOutIso: string | null | undefined,
  now: Date = new Date(),
): string {
  const at = autoFinishPhrase(checkOutIso, now);
  return at
    ? `Esperando que el comercio lo cierre. Si no, Oído lo cierra ${at} (72 horas después de tu salida).`
    : "Esperando que el comercio lo cierre. Si no, Oído lo cierra 72 horas después de tu salida.";
}
