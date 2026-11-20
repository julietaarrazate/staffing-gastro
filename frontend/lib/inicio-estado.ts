import { formatShiftTime, isTodayInArgentina } from "@/lib/datetime";
import { SKILL_LABELS, type Shift, type ShiftApplication, type ShiftStatus } from "@/lib/types";

/**
 * Qué dice el título del Inicio de quien trabaja (`/feed`), según lo que
 * pasa. Una sola decisión, pura y probada: la pantalla sólo la dibuja.
 *
 * Orden de prioridad:
 *   cargando            → todavía no se sabe (esqueleto, sin título que mienta)
 *   turno de hoy        → la persona ya tiene un turno asignado hoy:
 *     `hoy-mas-tarde`     faltan más de 60 min  → «Hoy trabajás a las 20:00»
 *     `hoy-por-empezar`   faltan 60 min o menos → «Empezás en 28 min»
 *     `hoy-en-curso`      ya empezó, no terminó → «Estás en <local> hasta las 02:00»
 *   `con-error`         → el feed no cargó (el vacío de abajo es el cartel de error)
 *   `con-turnos`        → hay turnos para mostrar → «Hay turno a la vuelta»
 *   `tranquilo`         → no hay ninguno          → «Todo tranquilo por ahora»
 */

/** Estados del turno que ya no se trabajan. Los reales del backend
 * (`shift/domain/value_objects.py`): `TERMINAL_STATUSES` (finalizado, pagado,
 * cancelado, no_cubierto) y `check_out`, que ya se trabajó (se finaliza y se
 * paga, U081). */
const TURNO_YA_NO_SE_TRABAJA: ReadonlySet<ShiftStatus> = new Set<ShiftStatus>([
  "cancelado",
  "no_cubierto",
  "finalizado",
  "pagado",
  "check_out",
]);

/** Hasta cuántos minutos antes el cielo pasa a «Empezás en N min». */
export const MINUTOS_PARA_EMPEZAR = 60;

export interface TurnoDeHoy {
  shiftId: string;
  /** «Mozo/a». */
  puesto: string;
  /** Nombre del local, si el turno lo trae. */
  local: string | null;
  /** Dirección y/o zona que ya trae el turno, si hay. */
  lugar: string | null;
  /** «20:00», hora de Argentina, 24 h. */
  horaInicio: string;
  horaFin: string;
}

export type InicioEstado =
  | { tipo: "cargando" }
  | { tipo: "hoy-mas-tarde"; turno: TurnoDeHoy }
  | { tipo: "hoy-por-empezar"; turno: TurnoDeHoy; minutos: number }
  | { tipo: "hoy-en-curso"; turno: TurnoDeHoy }
  | { tipo: "con-error" }
  | { tipo: "con-turnos" }
  | { tipo: "tranquilo" };

export interface InicioEntrada {
  /** `GET /applications/mine`; vacío si falló o no hay. */
  postulaciones: readonly Pick<ShiftApplication, "status" | "shift">[];
  /** Cuántos turnos del feed se van a mostrar. */
  turnosParaMostrar: number;
  ahora: Date;
  cargando: boolean;
  /** El feed no cargó. */
  conError?: boolean;
}

/** El turno asignado que cuenta hoy: el que está en curso o, si no, el que
 * empieza primero. «Hoy» es el día de Argentina de `ahora`; un turno que
 * empezó ayer y termina de madrugada cuenta mientras está en curso. */
function turnoAsignadoDeHoy(
  postulaciones: InicioEntrada["postulaciones"],
  ahora: Date
): Shift | null {
  const t = ahora.getTime();
  const candidatos: { shift: Shift; inicio: number; fin: number }[] = [];
  for (const p of postulaciones) {
    const shift = p.shift;
    if (p.status !== "aceptada" || !shift) continue;
    if (TURNO_YA_NO_SE_TRABAJA.has(shift.status)) continue;
    const inicio = new Date(shift.start_at).getTime();
    const fin = new Date(shift.end_at).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= t) continue;
    const enCurso = inicio <= t;
    if (!enCurso && !isTodayInArgentina(shift.start_at, ahora)) continue;
    candidatos.push({ shift, inicio, fin });
  }
  if (candidatos.length === 0) return null;
  const enCurso = candidatos.filter((c) => c.inicio <= t);
  const lista = enCurso.length > 0 ? enCurso : candidatos;
  lista.sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  return lista[0].shift;
}

function datosDelTurno(shift: Shift): TurnoDeHoy {
  return {
    shiftId: shift.id,
    puesto: SKILL_LABELS[shift.position] ?? shift.position,
    local: shift.company_name?.trim() || null,
    lugar: [shift.address, shift.city].filter((x): x is string => !!x?.trim()).join(" · ") || null,
    horaInicio: formatShiftTime(shift.start_at),
    horaFin: formatShiftTime(shift.end_at),
  };
}

export function decidirInicio(entrada: InicioEntrada): InicioEstado {
  if (entrada.cargando) return { tipo: "cargando" };
  const shift = turnoAsignadoDeHoy(entrada.postulaciones, entrada.ahora);
  if (shift) {
    const turno = datosDelTurno(shift);
    const falta = new Date(shift.start_at).getTime() - entrada.ahora.getTime();
    if (falta <= 0) return { tipo: "hoy-en-curso", turno };
    if (falta > MINUTOS_PARA_EMPEZAR * 60_000) return { tipo: "hoy-mas-tarde", turno };
    return { tipo: "hoy-por-empezar", turno, minutos: Math.max(1, Math.ceil(falta / 60_000)) };
  }
  if (entrada.conError) return { tipo: "con-error" };
  return entrada.turnosParaMostrar > 0 ? { tipo: "con-turnos" } : { tipo: "tranquilo" };
}
