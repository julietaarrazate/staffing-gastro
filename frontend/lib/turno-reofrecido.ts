import { formatShiftTime } from "@/lib/datetime";
import type { Shift } from "@/lib/types";

/**
 * Turno reofrecido (U080): un turno que se reabre con el horario ya empezado
 * se vuelve a ofrecer como urgente hasta que termina, si le queda al menos
 * una hora; con menos, pasa a «no cubierto». La regla vive en el backend
 * (`Shift._reopen`, `REOFFER_MIN_REMAINING`); esto es su espejo para los
 * textos del panel del comercio, que dicen qué va a pasar antes de tocar.
 */

/** Lo mínimo de horario que tiene que quedar para reofrecer. */
export const REOFFER_MIN_REMAINING_MS = 60 * 60_000;

/** «No se presentó» se habilita 15 minutos después de la hora en que se
 *  esperaba a la persona (la tolerancia de la puntualidad). */
export const NO_SHOW_AFTER_MS = 15 * 60_000;

type Reofrecible = Pick<Shift, "start_at" | "end_at">;

/** ¿Se reofrecería si se reabre ahora? Sólo tiene sentido con el turno ya
 *  empezado: antes vuelve a buscar personal como siempre. */
export function seReofrece(shift: Reofrecible, now: number = Date.now()): boolean {
  return new Date(shift.end_at).getTime() - now >= REOFFER_MIN_REMAINING_MS;
}

/**
 * Desde cuándo se espera a la persona, en milisegundos: el inicio del turno
 * o, si es el reemplazo de un turno reofrecido (confirmó con el turno ya
 * empezado), el momento en que confirmó. En un turno común se cuenta desde el
 * inicio aunque haya confirmado tarde. Mismo criterio que
 * `Shift.expected_from` / `taken_after_start` en el backend.
 */
type Esperable = Pick<Shift, "start_at" | "confirmed_at" | "reoffered_at">;

export function esperadoDesde(shift: Esperable): number {
  const inicio = new Date(shift.start_at).getTime();
  if (!shift.reoffered_at) return inicio;
  const confirmo = shift.confirmed_at ? new Date(shift.confirmed_at).getTime() : NaN;
  return Number.isFinite(confirmo) && confirmo > inicio ? confirmo : inicio;
}

/** ¿Ya se puede marcar «No se presentó»? El servidor aplica la misma regla. */
export function puedeMarcarAusencia(shift: Esperable, now: number = Date.now()): boolean {
  return now >= esperadoDesde(shift) + NO_SHOW_AFTER_MS;
}

/** Cerca del umbral de una hora, el reloj del dispositivo no alcanza para
 *  decir qué va a pasar: lo decide el servidor con su hora, al marcarlo, y
 *  entre abrir el diálogo y tocar pueden pasar minutos. */
export const REOFFER_UNCERTAIN_MARGIN_MS = 15 * 60_000;

/** El cuerpo de «¿Marcar que no se presentó?»: qué pasa con el turno. A menos
 *  de 15 minutos del umbral (en cualquiera de los dos sentidos) dice las dos
 *  posibilidades en vez de prometer una. */
export function noShowConfirmCopy(shift: Reofrecible, now: number = Date.now()): string {
  const fin = formatShiftTime(shift.end_at);
  const resta = new Date(shift.end_at).getTime() - now;
  const queda =
    Math.abs(resta - REOFFER_MIN_REMAINING_MS) < REOFFER_UNCERTAIN_MARGIN_MS
      ? `Como el turno ya empezó, si al marcarlo le queda al menos una hora de horario lo reofrecemos como urgente hasta las ${fin} (quien lo tome cobra lo que reste desde que llegue); si no, pasa a «no cubierto» y podés publicarlo de nuevo.`
      : seReofrece(shift, now)
        ? `Como el turno ya empezó, lo reofrecemos como urgente hasta las ${fin}: quien lo tome cobra lo que reste desde que llegue.`
        : "Queda menos de una hora de horario, así que no se reofrece: el turno pasa a «no cubierto» y podés publicarlo de nuevo.";
  return `${queda} Al trabajador le va a impactar la reputación. Esta acción queda registrada.`;
}

/** La línea del panel para un turno reofrecido que todavía busca reemplazo. */
export function reofferedHint(shift: Pick<Shift, "end_at">): string {
  return `Reofrecido como urgente hasta las ${formatShiftTime(shift.end_at)}.`;
}
