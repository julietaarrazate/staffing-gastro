import type { Shift } from "@/lib/types";

/**
 * «Urgentes» del Inicio de quien trabaja (`/feed`): los turnos que EMPIEZAN
 * en las próximas 6 horas, con cuánto falta. Es la cercanía del horario, no
 * la marca «Urgente» que pone el comercio (`shift.urgent`), que se sigue
 * viendo donde ya se veía. Funciones puras: la fila sólo las dibuja.
 *
 * Todo se mide con la diferencia de instantes (`start_at` es un ISO con
 * zona), así que no depende de la zona del navegador: «falta 1 h 40» es lo
 * mismo en Buenos Aires que en Madrid.
 */

/** La ventana: hasta 6 h antes del inicio (inclusive). */
export const VENTANA_URGENTES_MS = 6 * 60 * 60 * 1000;

/** Cuántas tarjetas como máximo. */
export const MAX_URGENTES = 8;

export interface Urgente {
  shift: Shift;
  /** Milisegundos hasta el inicio (siempre > 0 y ≤ la ventana). */
  faltaMs: number;
}

/**
 * Los turnos de `shifts` que empiezan dentro de la ventana, el que empieza
 * antes primero (a igual hora, el orden en que vinieron) y hasta
 * `MAX_URGENTES`. Un turno que ya empezó (falta ≤ 0) o que empieza más allá
 * de la ventana queda afuera; una fecha ilegible, también.
 */
export function urgentesDe(shifts: readonly Shift[], ahora: Date): Urgente[] {
  const t = ahora.getTime();
  return shifts
    .map((shift) => ({ shift, faltaMs: new Date(shift.start_at).getTime() - t }))
    .filter((u) => Number.isFinite(u.faltaMs) && u.faltaMs > 0 && u.faltaMs <= VENTANA_URGENTES_MS)
    .sort((a, b) => a.faltaMs - b.faltaMs)
    .slice(0, MAX_URGENTES);
}

/**
 * «45 min», «1 h 40», «5 h». Los minutos se redondean para arriba (a 59 s
 * todavía «1 min») y nunca baja de 1.
 */
export function faltaEn(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** «Empieza en 1 h 40». */
export function empiezaEn(ms: number): string {
  return `Empieza en ${faltaEn(ms)}`;
}
