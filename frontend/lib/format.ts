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

/**
 * Número con un decimal y coma, como se escribe en Argentina: `formatDecimal1(4.9)`
 * -> "4,9". Antes cada componente usaba `toFixed(1)` ("4.9"), y la misma
 * pantalla mezclaba "0.6 km" en una tarjeta con "0,6 km" en la push.
 */
export function formatDecimal1(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Distancia en kilómetros con coma decimal: `formatKm(0.6)` -> "0,6 km". */
export function formatKm(km: number): string {
  return `${formatDecimal1(km)} km`;
}

/**
 * Distancia legible, la única de la app: bajo 1 km en metros redondeados
 * ("800 m"), desde 1 km con un decimal y coma ("1,5 km").
 */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : formatKm(km);
}

/**
 * Cantidad con su sustantivo en singular o plural: `plural(1, "turno", "turnos")`
 * -> "1 turno", `plural(3, "turno", "turnos")` -> "3 turnos". Para no escribir
 * a mano «{n} turnos» y terminar en «1 turnos».
 */
export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
