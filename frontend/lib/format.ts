/**
 * Formatea un monto en pesos argentinos con separador de miles (punto) y sin
 * decimales, ej. `formatArs(20000)` -> "$20.000". `price_ars` puede llegar
 * como number o como string (serialización de `Decimal` del backend).
 */
export function formatArs(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}
