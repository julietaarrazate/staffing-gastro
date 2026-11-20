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
 *     `hoy-en-curso`      marcó la llegada, no terminó → «Estás en <local> hasta las 02:00»
 *     `hoy-empezo`        ya empezó y no marcó la llegada → «Tu turno en <local> empezó a las 20:00»
 *   `con-error`         → el feed no cargó (el vacío de abajo es el cartel de error)
 *   `con-turnos`        → hay turnos para mostrar → «Hay turno a la vuelta»
 *   `tranquilo`         → no hay ninguno          → «Todo tranquilo por ahora»
 */

/** Estados del turno que cuentan para el título: los de un turno ya asignado
 * a la persona y todavía por trabajar o en marcha (lista de permitidos; los
 * nombres son los de `shift/domain/value_objects.py`). Cualquier otro
 * (`borrador`, `publicado`, `buscando_personal`, `check_out`, los terminales)
 * no cuenta. */
const TURNO_QUE_SE_TRABAJA: ReadonlySet<ShiftStatus> = new Set<ShiftStatus>([
  "asignado",
  "confirmado",
  "en_camino",
  "check_in",
  "trabajando",
]);

/** Con la llegada marcada: la persona está en el local. */
const LLEGADA_MARCADA: ReadonlySet<ShiftStatus> = new Set<ShiftStatus>(["check_in", "trabajando"]);

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
  /** Marcó la llegada (`check_in`/`trabajando`): «Estás en <local> hasta las». */
  | { tipo: "hoy-en-curso"; turno: TurnoDeHoy }
  /** Ya pasó la hora de inicio y todavía no marcó la llegada. */
  | { tipo: "hoy-empezo"; turno: TurnoDeHoy }
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

/** Hasta cuánto antes un turno cuenta aunque su día en Argentina sea mañana. */
const VENTANA_MS = MINUTOS_PARA_EMPEZAR * 60_000;

/** El turno asignado que cuenta ahora: el que está en curso o, si no, el que
 * empieza primero. Cuenta si ya empezó (aunque haya empezado ayer y termine de
 * madrugada), si empieza hoy (día de Argentina) o si empieza dentro de la
 * próxima hora aunque ya sea mañana (23:50 y empieza 00:20). */
function turnoAsignadoDeHoy(
  postulaciones: InicioEntrada["postulaciones"],
  ahora: Date
): Shift | null {
  const t = ahora.getTime();
  const candidatos: { shift: Shift; inicio: number; fin: number }[] = [];
  for (const p of postulaciones) {
    const shift = p.shift;
    if (p.status !== "aceptada" || !shift) continue;
    if (!TURNO_QUE_SE_TRABAJA.has(shift.status)) continue;
    const inicio = new Date(shift.start_at).getTime();
    const fin = new Date(shift.end_at).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= t) continue;
    const enCurso = inicio <= t;
    if (!enCurso && inicio - t > VENTANA_MS && !isTodayInArgentina(shift.start_at, ahora)) continue;
    candidatos.push({ shift, inicio, fin });
  }
  if (candidatos.length === 0) return null;
  const enCurso = candidatos.filter((c) => c.inicio <= t);
  const lista = enCurso.length > 0 ? enCurso : candidatos;
  lista.sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  return lista[0].shift;
}

/** ¿Hace falta el reloj? Sólo si hay un turno aceptado, en un estado que se
 * trabaja, que está en curso o empieza dentro de las próximas 24 h. */
export function relojNecesario(postulaciones: InicioEntrada["postulaciones"], ahora: Date): boolean {
  const t = ahora.getTime();
  return postulaciones.some((p) => {
    const shift = p.shift;
    if (p.status !== "aceptada" || !shift || !TURNO_QUE_SE_TRABAJA.has(shift.status)) return false;
    const inicio = new Date(shift.start_at).getTime();
    const fin = new Date(shift.end_at).getTime();
    if (Number.isNaN(inicio) || Number.isNaN(fin)) return false;
    return fin > t && inicio - t <= 24 * 3_600_000;
  });
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
    if (falta <= 0) {
      return LLEGADA_MARCADA.has(shift.status) ? { tipo: "hoy-en-curso", turno } : { tipo: "hoy-empezo", turno };
    }
    if (falta > MINUTOS_PARA_EMPEZAR * 60_000) return { tipo: "hoy-mas-tarde", turno };
    return { tipo: "hoy-por-empezar", turno, minutos: Math.max(1, Math.ceil(falta / 60_000)) };
  }
  if (entrada.conError) return { tipo: "con-error" };
  return entrada.turnosParaMostrar > 0 ? { tipo: "con-turnos" } : { tipo: "tranquilo" };
}
