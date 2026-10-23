// Cuentas de "Turnos en vivo" y de "Métricas" con período, sin React para
// poder probarlas sueltas.

/** "8 min", "1 h 05", "2 d 3 h": cuánto lleva un turno sin cubrir. */
export function formatMinutesOpen(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const hours = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
  }
  const days = Math.floor(m / (24 * 60));
  const hours = Math.floor((m % (24 * 60)) / 60);
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}

/** Cada cuánto se actualiza "Turnos en vivo" mientras está a la vista. */
export const LIVE_REFRESH_MS = 30_000;

/** La promesa: un turno se cubre en menos de 10 minutos. */
export const PROMISE_MINUTES = 10;

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  direction: DeltaDirection;
  /** Variación porcentual redondeada, sin signo; `null` si no hay base
   * para calcularla (el período anterior fue cero o no tuvo muestra). */
  pct: number | null;
  /** `true` si el cambio es bueno para el negocio, `false` si es malo,
   * `null` si no cambió o no se puede comparar. */
  good: boolean | null;
}

/**
 * Comparación contra el período anterior. `lowerIsBetter` para métricas
 * donde bajar es bueno (tiempo hasta cubrir). Sin dato en alguno de los dos
 * períodos, no hay comparación (`flat`, `pct: null`). Contra un anterior en
 * cero, la flecha dice hacia dónde fue pero no hay `%` (sería infinito).
 */
export function periodDelta(
  current: number | null,
  previous: number | null,
  { lowerIsBetter = false }: { lowerIsBetter?: boolean } = {}
): Delta {
  if (current === null || previous === null) return { direction: "flat", pct: null, good: null };
  if (current === previous) return { direction: "flat", pct: 0, good: null };
  const direction: DeltaDirection = current > previous ? "up" : "down";
  const pct = previous === 0 ? null : Math.round((Math.abs(current - previous) / previous) * 100);
  const good = direction === "up" ? !lowerIsBetter : lowerIsBetter;
  return { direction, pct, good };
}

/** "↑ 25 %", "↓ 10 %", "= igual", "↑" (sin base), "sin datos". */
export function formatDelta(delta: Delta): string {
  if (delta.direction === "flat") return delta.pct === 0 ? "= igual" : "sin datos";
  const arrow = delta.direction === "up" ? "↑" : "↓";
  return delta.pct === null ? `${arrow} desde 0` : `${arrow} ${delta.pct} %`;
}
