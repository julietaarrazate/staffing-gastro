/**
 * La regla del horario de un turno nuevo, en el formulario (G14: U055, U056,
 * U060). Es la misma que aplica el servidor en `shift/domain/schedule.py`: el
 * inicio no puede haber pasado (tolerancia de 5 minutos) y la duración va de 1
 * a 16 horas (decisión 15 de la beta). Si cambia una, cambia la otra.
 *
 * Trabaja con el valor crudo de los `<input type="datetime-local">` (hora de
 * pared de Argentina, "2026-11-20T21:00"), que es lo que guardan los
 * formularios.
 *
 * Fin anterior al inicio con la misma fecha («de 21:00 a 02:00»): se toma como
 * el día siguiente, que es lo que quiso decir quien trabaja de noche. Si la
 * fecha del fin es anterior a la del inicio no se adivina nada: es un error.
 */
import { argentinaISOToLocalInput, localInputToArgentinaISO } from "@/lib/datetime";

export const TURNO_DURACION_MIN_MINUTOS = 60;
export const TURNO_DURACION_MAX_MINUTOS = 16 * 60;
export const TURNO_TOLERANCIA_INICIO_MINUTOS = 5;

const DIA_MS = 24 * 60 * 60_000;

export interface HorarioTurno {
  /** Fin ya resuelto (con el día siguiente si hacía falta); "" si no hay fin. */
  fin: string;
  /** El fin que se escribió quedó un día después del inicio. */
  alDiaSiguiente: boolean;
  /** Duración en minutos; null si falta un extremo o el rango no cierra. */
  minutos: number | null;
  /** Qué falla en el inicio / en el fin, ya en castellano; null si está bien. */
  errorInicio: string | null;
  errorFin: string | null;
  /** Hay inicio y fin y la regla se cumple: se puede seguir y publicar. */
  valido: boolean;
}

function sumarUnDia(valor: string): string {
  const ms = Date.parse(localInputToArgentinaISO(valor)) + DIA_MS;
  return argentinaISOToLocalInput(new Date(ms).toISOString());
}

export function resolverHorario(inicio: string, fin: string, ahora: Date = new Date()): HorarioTurno {
  let errorInicio: string | null = null;
  let errorFin: string | null = null;
  let finResuelto = fin;
  let alDiaSiguiente = false;
  let minutos: number | null = null;

  const inicioMs = inicio ? Date.parse(localInputToArgentinaISO(inicio)) : NaN;
  if (!Number.isNaN(inicioMs) && inicioMs < ahora.getTime() - TURNO_TOLERANCIA_INICIO_MINUTOS * 60_000) {
    errorInicio = "Ese inicio ya pasó. Elegí un horario desde ahora en adelante.";
  }

  if (!Number.isNaN(inicioMs) && fin) {
    if (fin.slice(0, 10) === inicio.slice(0, 10) && fin < inicio) {
      finResuelto = sumarUnDia(fin);
      alDiaSiguiente = true;
    }
    const finMs = Date.parse(localInputToArgentinaISO(finResuelto));
    if (!Number.isNaN(finMs)) {
      if (finMs === inicioMs) {
        errorFin = "El fin tiene que ser distinto del inicio.";
      } else if (finMs < inicioMs) {
        errorFin = "El fin tiene que ser después del inicio.";
      } else {
        minutos = Math.round((finMs - inicioMs) / 60_000);
        if (minutos < TURNO_DURACION_MIN_MINUTOS) {
          errorFin = "Un turno dura al menos 1 hora.";
        } else if (minutos > TURNO_DURACION_MAX_MINUTOS) {
          errorFin = "Un turno dura hasta 16 horas. Para cubrir más tiempo, publicá dos turnos.";
        }
      }
    }
  }

  return {
    fin: finResuelto,
    alDiaSiguiente,
    minutos: errorFin ? null : minutos,
    errorInicio,
    errorFin,
    valido: inicio !== "" && fin !== "" && minutos != null && !errorInicio && !errorFin,
  };
}

/**
 * Duplicar: el mismo horario una semana después, y si el turno original es
 * viejo, la próxima semana que todavía no pasó (si no, el duplicado nacería
 * con un inicio que el servidor rechaza). Devuelve cuántos días mover.
 */
export function diasParaDuplicar(inicioIso: string, ahora: Date = new Date()): number {
  let dias = 7;
  while (Date.parse(inicioIso) + dias * DIA_MS < ahora.getTime()) dias += 7;
  return dias;
}
