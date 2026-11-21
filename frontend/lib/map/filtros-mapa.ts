import { claveDiaArgentina } from "@/lib/semana";
import type { Shift } from "@/lib/types";

/**
 * Los chips de `/map` (2026-11-21): filtran EN EL CLIENTE los turnos que ya
 * llegaron. «Hoy», «Mañana» y «Fin de semana» son uno a la vez; «Paga más» es
 * un interruptor aparte que se combina con cualquiera. No se mandan al backend
 * ni se recuerdan entre visitas.
 */
export type Cuando = "hoy" | "manana" | "finde";

export interface FiltrosMapa {
  cuando: Cuando | null;
  pagaMas: boolean;
}

export const SIN_FILTROS: FiltrosMapa = { cuando: null, pagaMas: false };

export function hayFiltros(f: FiltrosMapa): boolean {
  return f.cuando !== null || f.pagaMas;
}

/** "YYYY-MM-DD" más `dias` (al mediodía UTC: sumar días no cruza fechas). */
function sumarDias(clave: string, dias: number): string {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias, 12)).toISOString().slice(0, 10);
}

/**
 * Los días (claves de Argentina) que cubre cada chip, a partir de `ahora`.
 * «Fin de semana» = el sábado y domingo que vienen; si hoy ya es sábado o
 * domingo, los de este fin de semana (el sábado de ayer y el domingo de hoy
 * si hoy es domingo).
 */
export function diasDelChip(cuando: Cuando, ahora: Date): string[] {
  const hoy = claveDiaArgentina(ahora);
  if (cuando === "hoy") return [hoy];
  if (cuando === "manana") return [sumarDias(hoy, 1)];
  const [y, m, d] = hoy.split("-").map(Number);
  const desdeLunes = (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7; // lun 0 … dom 6
  const sabado = desdeLunes === 6 ? sumarDias(hoy, -1) : sumarDias(hoy, 5 - desdeLunes);
  return [sabado, sumarDias(sabado, 1)];
}

/** Los turnos que pasan los filtros, por el día de INICIO en hora de Argentina. */
export function filtrarTurnos<T extends Pick<Shift, "start_at" | "pay_band">>(
  turnos: T[],
  filtros: FiltrosMapa,
  ahora: Date = new Date()
): T[] {
  if (!hayFiltros(filtros)) return turnos;
  const dias = filtros.cuando ? diasDelChip(filtros.cuando, ahora) : null;
  return turnos.filter((t) => {
    if (dias && !dias.includes(claveDiaArgentina(t.start_at))) return false;
    if (filtros.pagaMas && t.pay_band !== "por_encima") return false;
    return true;
  });
}
