import { claveDiaArgentina, diaEnPalabras, type DiaSemana } from "@/lib/semana";
import type { Shift, ShiftStatus } from "@/lib/types";

// Familias de estado del panel (bug de la operadora, docs/planning/PULIDO_ROADMAP.md
// batch "panel-por-estados": "activos 2 pero abajo la lista completa con
// inactivos; buscando 1 y no muestra cuál; deberían estar agrupados por
// estado, cancelados con cancelados, finalizados con finalizados"). El estado
// real de cada turno decide en qué familia cae, y la familia decide qué
// pestaña lo muestra: el conteo de cada pestaña es siempre el largo real de
// esa familia, nunca un número desconectado de la lista.
export type Family = "borrador" | "buscando" | "en_marcha" | "terminado" | "cancelado";

export const FAMILY_STATUSES: Record<Family, ShiftStatus[]> = {
  borrador: ["borrador"],
  buscando: ["publicado", "buscando_personal"],
  // `confirmado` va en "en marcha", no en "terminado" (fix 2026-09). Estaba
  // agrupado con finalizado/pagado, así que un turno confirmado —que todavía
  // no pasó, y donde el trabajador ni siquiera llegó— aparecía bajo
  // "Terminados". Quedó a la vista con "va en camino": el trabajador viajando
  // al local y su turno figurando como terminado.
  //
  // El criterio de la familia es "¿queda algo por pasar?", no "¿está cerrado
  // el trato?": confirmado es exactamente el momento en que el turno está en
  // curso hacia su ejecución, igual que asignado o check_in.
  en_marcha: ["asignado", "confirmado", "en_camino", "check_in", "trabajando", "check_out"],
  terminado: ["finalizado", "pagado"],
  // `no_cubierto` (ADR-0015) entra en esta familia, no en una propia: por el
  // mismo criterio de arriba ("¿queda algo por pasar? No"), es tan terminal
  // como cancelado. La tarjeta lo distingue igual (estado y pasos propios):
  // comparten pestaña, no etiqueta.
  cancelado: ["cancelado", "no_cubierto"],
};

// Orden de despliegue en la pestaña "Todos": borradores primero (ni siquiera
// se publicaron todavía), buscando, en marcha, terminados y cancelados al
// final.
export const FAMILY_ORDER: Family[] = ["borrador", "buscando", "en_marcha", "terminado", "cancelado"];

export function familyOf(status: ShiftStatus): Family {
  return FAMILY_ORDER.find((family) => FAMILY_STATUSES[family].includes(status)) ?? "buscando";
}

/**
 * Lo que el cielo del panel responde (ADR-0028, «Identidad por pantalla»:
 * «¿Está cubierto?»). Sale sólo de lo que ya trae `GET /shifts/me`.
 *
 * - `enMarcha`: hay algún turno en curso (buscando o en marcha, de cualquier
 *   día). Es lo que vuelve hondo al cielo; sin eso, es el cielo de día.
 * - `elegir`: el turno que espera que el comercio elija (tiene postulaciones
 *   pendientes), el que empieza antes. Es el ámbar de la pantalla.
 * - `nadie`: hay turnos buscando y ninguno tiene postulaciones; el que
 *   empieza antes.
 *
 * El número del cielo ya no sale de acá: cuenta los turnos de un día y
 * depende de la tira (`tituloDelDia`).
 */
export interface ResumenPanel {
  enMarcha: boolean;
  /** Algún turno está buscando: el punto de «Marchando» late. */
  marchando: boolean;
  elegir: Shift | null;
  nadie: Shift | null;
}

const porInicio = (a: Shift, b: Shift) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime();

const enCurso = (s: Shift) => {
  const family = familyOf(s.status);
  return family === "buscando" || family === "en_marcha";
};

export function resumenPanel(shifts: Shift[]): ResumenPanel {
  const activos = shifts.filter(enCurso);
  const buscandoTodos = activos.filter((s) => familyOf(s.status) === "buscando").sort(porInicio);
  const elegir = buscandoTodos.find((s) => (s.pending_applicants_count ?? 0) > 0) ?? null;
  return {
    enMarcha: activos.length > 0,
    marchando: buscandoTodos.length > 0,
    elegir,
    nadie: elegir ? null : (buscandoTodos[0] ?? null),
  };
}

/** Lo que dice el cielo del día que se mira (`tituloDelDia`). */
export interface TituloDelDia {
  /** Lo de antes del número: «Hoy tenés», «El sábado tenés», «Hoy no tenés turnos». */
  antes: string;
  /** «3 turnos» / «1 turno»; vacío si no hay turnos. */
  destacado: string;
  /** Cuántos turnos cuenta el día (sin cancelados ni borradores). */
  cuenta: number;
  /** De esos, cuántos siguen buscando personal. */
  sinCubrir: number;
  /** Con hoy sin turnos: «El próximo es el viernes»; `null` si no hay otro. */
  proximo: string | null;
  /** El saludo («Hola, Julieta.») va sólo mirando hoy. */
  conSaludo: boolean;
}

/** Los turnos que cuentan para el número: ni cancelados (ni no cubiertos) ni borradores. */
const cuentaParaElDia = (s: Shift) => {
  const family = familyOf(s.status);
  return family !== "cancelado" && family !== "borrador";
};

const DIA_MS = 86_400_000;
const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8)) - Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8))) / DIA_MS);

/** «el sábado» (de hoy a una semana) o «el sábado 28» (más lejos, o ya pasado hace rato). */
function nombreDelDia(clave: string, hoy: string): string {
  const palabras = diaEnPalabras(clave);
  const d = diasEntre(hoy, clave);
  return Math.abs(d) <= 6 ? `el ${palabras.split(" ")[0]}` : `el ${palabras}`;
}

const turnos = (n: number) => `${n} ${n === 1 ? "turno" : "turnos"}`;

/**
 * El título del cielo: cuántos turnos tiene el día que se mira. Sin día
 * elegido (`dia` = `null`) es hoy: «Hoy tenés 3 turnos»; con uno, ese día
 * («El sábado tenés 2 turnos», «Mañana tenés…», «El lunes tuviste…»). Un
 * turno de anoche que sigue en marcha cuenta como de hoy. Si hoy no hay
 * turnos, además dice cuál es el próximo.
 */
export function tituloDelDia(shifts: Shift[], dia: string | null, ahora: Date = new Date()): TituloDelDia {
  const hoy = claveDiaArgentina(ahora);
  const clave = dia ?? hoy;
  const esHoy = clave === hoy;
  const contados = shifts.filter(cuentaParaElDia);
  const delDia = contados.filter((s) => {
    if (claveDiaArgentina(s.start_at) === clave) return true;
    // Empezó antes de hoy y sigue en curso (anoche, pasada la medianoche).
    return (
      esHoy &&
      familyOf(s.status) === "en_marcha" &&
      new Date(s.start_at).getTime() < ahora.getTime() &&
      new Date(s.end_at).getTime() > ahora.getTime()
    );
  });
  const cuenta = delDia.length;
  const sinCubrir = delDia.filter((s) => familyOf(s.status) === "buscando").length;

  const futuro = diasEntre(hoy, clave) >= 0;
  const cuando = esHoy ? "Hoy" : diasEntre(hoy, clave) === 1 ? "Mañana" : capitalizar(nombreDelDia(clave, hoy));
  const verbo = futuro ? (cuenta === 0 ? "no tenés" : "tenés") : cuenta === 0 ? "no tuviste" : "tuviste";
  const antes = cuenta === 0 ? `${cuando} ${verbo} turnos` : `${cuando} ${verbo}`;

  let proximo: string | null = null;
  if (esHoy && cuenta === 0) {
    const siguiente = contados
      .filter(enCurso)
      .map((s) => claveDiaArgentina(s.start_at))
      .filter((c) => c > hoy)
      .sort()[0];
    if (siguiente) {
      proximo = diasEntre(hoy, siguiente) === 1 ? "El próximo es mañana" : `El próximo es ${nombreDelDia(siguiente, hoy)}`;
    }
  }
  return { antes, destacado: cuenta === 0 ? "" : turnos(cuenta), cuenta, sinCubrir, proximo, conSaludo: dia === null || esHoy };
}

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Los turnos que se ven: el día elegido o, sin día, la semana (`dias`). */
export function turnosEnLaVista(shifts: Shift[], dias: DiaSemana[], dia: string | null): Shift[] {
  const claves = new Set(dias.map((d) => d.clave));
  return shifts.filter((s) => {
    const c = claveDiaArgentina(s.start_at);
    return dia ? c === dia : claves.has(c);
  });
}

/**
 * «Más adelante»: los turnos de semanas que vienen (después de `ultimoDia`),
 * los que buscan personal primero y después los demás, cada grupo por fecha.
 */
export function ordenMasAdelante(shifts: Shift[], ultimoDia: string): Shift[] {
  const futuros = shifts.filter((s) => claveDiaArgentina(s.start_at) > ultimoDia).sort(porInicio);
  const buscando = futuros.filter((s) => familyOf(s.status) === "buscando");
  return [...buscando, ...futuros.filter((s) => familyOf(s.status) !== "buscando")];
}

/**
 * Un enlace que lleva a un grupo («/shifts?tab=buscando», del asistente): si
 * en la semana que se ve no hay ninguno de esa familia, el día del que más
 * cerca está (el primero que viene; si no hay, el último que hubo) para saltar
 * a su semana. `null`: ya está a la vista, o no hay ninguno.
 */
export function diaParaFamilia(shifts: Shift[], family: Family, dias: DiaSemana[], ahora: Date = new Date()): string | null {
  const delGrupo = shifts.filter((s) => familyOf(s.status) === family).sort(porInicio);
  if (delGrupo.length === 0) return null;
  const claves = new Set(dias.map((d) => d.clave));
  if (delGrupo.some((s) => claves.has(claveDiaArgentina(s.start_at)))) return null;
  const proximo = delGrupo.find((s) => new Date(s.start_at).getTime() >= ahora.getTime()) ?? delGrupo[delGrupo.length - 1];
  return claveDiaArgentina(proximo.start_at);
}
