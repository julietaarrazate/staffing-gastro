import type { Shift } from "@/lib/types";
import { shiftDurationMinutes } from "@/lib/datetime";
import { formatArs } from "@/lib/format";

type PayFields = Pick<Shift, "pay_amount" | "currency" | "start_at" | "end_at">;

/** Pago por hora; null si el turno no tiene una duración válida. Los turnos
 *  duran distinto, así que comparar el monto total engaña (ADR-0012). */
export function payPerHour(shift: PayFields): number | null {
  const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
  if (minutes === null) return null;
  return (Number(shift.pay_amount) / minutes) * 60;
}

/** Monto en pesos enteros (mismo criterio que `formatArs`): "$42.000" en pesos,
 * "USD 50" en otra moneda; un monto inválido es "—", nunca "$NaN". */
export function formatMoney(amount: number | string, currency: string): string {
  const n = Number(amount);
  if (amount === "" || !Number.isFinite(n)) return "—";
  return currency === "ARS"
    ? formatArs(n)
    : `${currency} ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

type PaidFields = Pick<Shift, "pay_amount" | "currency"> &
  Partial<Pick<Shift, "hourly_pay_amount" | "prorated_pay_amount">>;

/** Qué pago se muestra de un turno, y cómo. */
export interface PayView {
  /** `publicado`: el monto del turno, lo de siempre. `por_hora`: un turno
   *  reofrecido que nadie tomó todavía (se paga desde la llegada, así que el
   *  total no se sabe). `prorrateado`: reofrecido con la llegada marcada. */
  kind: "publicado" | "por_hora" | "prorrateado";
  /** El número, ya formateado: "$40.000". */
  amount: string;
  /** Lo que va pegado al número: "por hora", o nada. */
  suffix: string | null;
  /** Una línea que explica el número, cuando no es el monto publicado. */
  note: string | null;
}

/**
 * El único lugar que decide qué pago mostrar (U080). Un turno reofrecido (se
 * reabrió ya empezado) se paga por lo que resta desde que llega el reemplazo:
 * hasta que llega se muestra el valor por hora, y desde ahí el monto que
 * quedó fijo. Cualquier otro turno muestra su monto publicado. Los dos campos
 * los calcula el backend; acá no se hace ninguna cuenta.
 *
 * Fuera del caso `por_hora` (todavía no hay monto), es el espejo de
 * `Shift.amount_due` en el backend (`prorated_pay_amount ?? pay_amount`): si
 * cambia esa regla, cambia acá.
 */
export function payView(shift: PaidFields): PayView {
  if (shift.prorated_pay_amount != null) {
    return {
      kind: "prorrateado",
      amount: formatMoney(shift.prorated_pay_amount, shift.currency),
      suffix: null,
      note: "Por lo que restaba del turno desde la llegada",
    };
  }
  if (shift.hourly_pay_amount != null) {
    return {
      kind: "por_hora",
      amount: formatMoney(shift.hourly_pay_amount, shift.currency),
      suffix: "por hora",
      note: "Ya empezó · se paga desde que llegás",
    };
  }
  return {
    kind: "publicado",
    amount: formatMoney(shift.pay_amount, shift.currency),
    suffix: null,
    note: null,
  };
}

/** Pago en una frase: "$42.000", o "$10.000 por hora" en un turno reofrecido. */
export function formatPayAmount(shift: PaidFields): string {
  const view = payView(shift);
  return view.suffix ? `${view.amount} ${view.suffix}` : view.amount;
}

/** Pago para lugares angostos (un renglón de lista, un pin): "$10.000/h". */
export function formatPayCompact(shift: PaidFields): string {
  const view = payView(shift);
  return view.kind === "por_hora" ? `${view.amount}/h` : view.amount;
}

/** Lo que se cobra de un turno ya resuelto, para listas de una sola línea
 *  (la ficha del admin): "$40.000", o "$34.932 de $40.000" cuando lo que se
 *  cobra (`amount_due`, del backend) no es lo publicado: un turno reofrecido
 *  con la llegada marcada (U080). Sin `amount_due`, lo publicado. */
export function formatAmountDue(row: { pay_amount: string; amount_due?: string | null }): string {
  const publicado = formatArs(Number(row.pay_amount));
  if (row.amount_due == null || Number(row.amount_due) === Number(row.pay_amount)) return publicado;
  return `${formatArs(Number(row.amount_due))} de ${publicado}`;
}

/** Monto + extras: "$42.000 + propinas". */
export function formatPayShort(shift: PaidFields & Pick<Shift, "tips">): string {
  return shift.tips ? `${formatPayAmount(shift)} + propinas` : formatPayAmount(shift);
}

/** Orden "Mejores pagos": por pago por hora, de mayor a menor. Los que no tienen
 *  duración válida van al final, sin romper el orden relativo del resto. */
export function sortByBestPay<T extends PayFields>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => (payPerHour(b) ?? -1) - (payPerHour(a) ?? -1));
}
