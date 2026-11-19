/**
 * Serie semanal M7 de «Métricas» (docs/planning/BETA_TABLERO.md): fechas de
 * cada semana, el orden de los orígenes de las altas y el CSV para la lámina
 * de tracción y el reporte de los lunes.
 */
import { toCsv } from "./csv";
import { AR_TIMEZONE } from "./datetime";
import type { WeekSummary } from "./types";

/** Lunes de la semana, «16/11», en hora argentina. */
export function inicioSemana(semana: WeekSummary): string {
  return new Date(semana.start).toLocaleDateString("es-AR", {
    timeZone: AR_TIMEZONE,
    day: "numeric",
    month: "numeric",
  });
}

/** Lunes de la semana, «2026-11-16», para el CSV (ordena bien en una planilla). */
export function inicioSemanaIso(semana: WeekSummary): string {
  return new Date(semana.start).toLocaleDateString("en-CA", { timeZone: AR_TIMEZONE });
}

/** Los orígenes que aparecen en la serie: los que más altas traen en todas
 *  las semanas primero (a igual cantidad, por nombre) y «sin dato» al final,
 *  el mismo orden que «Altas por origen». */
export function origenesDeLaSerie(semanas: WeekSummary[]): (string | null)[] {
  const totales = new Map<string | null, number>();
  for (const semana of semanas) {
    for (const fila of semana.signups_by_origin) {
      totales.set(fila.origin, (totales.get(fila.origin) ?? 0) + fila.total);
    }
  }
  return [...totales.entries()]
    .sort(([a, ta], [b, tb]) => {
      if (a === null || b === null) return a === null ? 1 : -1;
      return tb - ta || a.localeCompare(b);
    })
    .map(([origen]) => origen);
}

/** Altas de un origen en una semana, por rol (cero si no hubo). */
export function altasDelOrigen(
  semana: WeekSummary,
  origen: string | null
): { workers: number; companies: number } {
  const fila = semana.signups_by_origin.find((f) => f.origin === origen);
  return { workers: fila?.workers ?? 0, companies: fila?.companies ?? 0 };
}

const numero = (n: number | null) => (n === null ? "" : String(Math.round(n * 10) / 10));

/** Una fila por semana, de la más vieja a la más nueva (como la quiere un
 *  gráfico), con una columna por origen y rol al final. */
export function serieACsv(semanas: WeekSummary[]): string {
  const origenes = origenesDeLaSerie(semanas);
  const encabezado = [
    "semana",
    "en curso",
    "publicados",
    "cubiertos",
    "cubiertos %",
    "cumplidos",
    "cumplidos %",
    "mediana hasta confirmar (min)",
    "cubiertos con aviso corto",
    "aviso corto en menos de 10 min %",
    "locales activos",
    "locales con un turno cubierto",
    "altas trabajadores",
    "altas comercios",
    ...origenes.flatMap((o) => {
      const nombre = o ?? "sin dato";
      return [`altas ${nombre} trabajadores`, `altas ${nombre} comercios`];
    }),
  ];
  const filas = semanas.map((s) => [
    inicioSemanaIso(s),
    s.in_progress ? "sí" : "no",
    String(s.shifts_published),
    String(s.shifts_covered),
    numero(s.covered_pct),
    String(s.fulfilled),
    numero(s.fulfilled_pct),
    numero(s.median_minutes_to_cover),
    String(s.short_notice_covered),
    numero(s.short_notice_under_10_min_pct),
    String(s.active_companies),
    String(s.companies_with_covered),
    String(s.signups_workers),
    String(s.signups_companies),
    ...origenes.flatMap((o) => {
      const altas = altasDelOrigen(s, o);
      return [String(altas.workers), String(altas.companies)];
    }),
  ]);
  return toCsv(encabezado, filas);
}
