import { isTodayInArgentina } from "@/lib/datetime";
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
 *   día). Es lo que vuelve hondo al cielo; sin eso, el cielo es el de día y
 *   pregunta «¿Te falta alguien hoy?».
 * - El número: los turnos de hoy si alguno de hoy sigue en curso (`deHoy`);
 *   si no, los que están en curso otros días. Con sus tres estados.
 * - `elegir`: el turno que espera que el comercio elija (tiene postulaciones
 *   pendientes), el que empieza antes. Es el ámbar de la pantalla.
 * - `nadie`: hay turnos buscando y ninguno tiene postulaciones; el que
 *   empieza antes.
 */
export interface ResumenPanel {
  enMarcha: boolean;
  deHoy: boolean;
  total: number;
  buscando: number;
  cubiertos: number;
  terminados: number;
  /** Algún turno está buscando: el punto de «Marchando» late. */
  marchando: boolean;
  elegir: Shift | null;
  nadie: Shift | null;
}

const porInicio = (a: Shift, b: Shift) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime();

export function resumenPanel(shifts: Shift[], now: Date = new Date()): ResumenPanel {
  const enCurso = (s: Shift) => {
    const family = familyOf(s.status);
    return family === "buscando" || family === "en_marcha";
  };
  const activos = shifts.filter(enCurso);
  const hoy = shifts.filter(
    (s) => (enCurso(s) || familyOf(s.status) === "terminado") && isTodayInArgentina(s.start_at, now)
  );
  const deHoy = hoy.some(enCurso);
  const conjunto = deHoy ? hoy : activos;
  const cuenta = (family: Family) => conjunto.filter((s) => familyOf(s.status) === family).length;

  const buscandoTodos = activos.filter((s) => familyOf(s.status) === "buscando").sort(porInicio);
  const elegir = buscandoTodos.find((s) => (s.pending_applicants_count ?? 0) > 0) ?? null;

  return {
    enMarcha: activos.length > 0,
    deHoy,
    total: conjunto.length,
    buscando: cuenta("buscando"),
    cubiertos: cuenta("en_marcha"),
    terminados: cuenta("terminado"),
    marchando: buscandoTodos.length > 0,
    elegir,
    nadie: elegir ? null : (buscandoTodos[0] ?? null),
  };
}
