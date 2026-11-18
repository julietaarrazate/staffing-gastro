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

/** Monto compacto para tarjetas chicas. */
export function formatPayAmount(shift: Pick<Shift, "pay_amount" | "currency">): string {
  return formatMoney(shift.pay_amount, shift.currency);
}

/** Monto + extras: "$42.000 + propinas". */
export function formatPayShort(shift: Pick<Shift, "pay_amount" | "currency" | "tips">): string {
  return shift.tips ? `${formatPayAmount(shift)} + propinas` : formatPayAmount(shift);
}

/** Orden "Mejores pagos": por pago por hora, de mayor a menor. Los que no tienen
 *  duración válida van al final, sin romper el orden relativo del resto. */
export function sortByBestPay<T extends PayFields>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => (payPerHour(b) ?? -1) - (payPerHour(a) ?? -1));
}
