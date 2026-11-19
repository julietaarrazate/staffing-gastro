import { describe, expect, it } from "vitest";
import {
  altasDelOrigen,
  inicioSemana,
  inicioSemanaIso,
  origenesDeLaSerie,
  serieACsv,
} from "./metricas-semanales";
import type { SignupsByOrigin, WeekSummary } from "./types";

function semana(start: string, altas: SignupsByOrigin[], extra: Partial<WeekSummary> = {}): WeekSummary {
  const s = new Date(start);
  return {
    start,
    end: new Date(s.getTime() + 7 * 24 * 3600 * 1000).toISOString(),
    in_progress: false,
    shifts_published: 4,
    shifts_covered: 3,
    covered_pct: 75,
    fulfilled: 2,
    fulfilled_pct: 66.666,
    median_minutes_to_cover: 8.25,
    short_notice_covered: 1,
    short_notice_under_10_min_pct: null,
    active_companies: 2,
    companies_with_covered: 1,
    signups_workers: altas.reduce((n, a) => n + a.workers, 0),
    signups_companies: altas.reduce((n, a) => n + a.companies, 0),
    signups_by_origin: altas,
    ...extra,
  };
}

const alta = (origin: string | null, workers: number, companies: number): SignupsByOrigin => ({
  origin,
  workers,
  companies,
  total: workers + companies,
});

// Lunes 00:00 en Argentina = 03:00 UTC.
const S1 = semana("2026-11-09T03:00:00Z", [alta("ig", 1, 0), alta(null, 0, 1)]);
const S2 = semana(
  "2026-11-16T03:00:00Z",
  [alta("volante", 2, 1), alta("ig", 0, 1), alta("ig/fundadores", 1, 0)],
  { in_progress: true, covered_pct: null, median_minutes_to_cover: null }
);

describe("fechas de la semana", () => {
  it("dan el lunes en hora argentina, no el día UTC", () => {
    expect(inicioSemana(S2)).toBe("16/11");
    expect(inicioSemanaIso(S2)).toBe("2026-11-16");
  });
});

describe("origenesDeLaSerie", () => {
  it("ordena por altas de todas las semanas, a igual cantidad por nombre, y deja «sin dato» al final", () => {
    expect(origenesDeLaSerie([S1, S2])).toEqual(["volante", "ig", "ig/fundadores", null]);
  });

  it("sin altas, no hay orígenes", () => {
    expect(origenesDeLaSerie([semana("2026-11-16T03:00:00Z", [])])).toEqual([]);
  });
});

describe("altasDelOrigen", () => {
  it("da cero si el origen no tuvo altas esa semana", () => {
    expect(altasDelOrigen(S1, "volante")).toEqual({ workers: 0, companies: 0 });
    expect(altasDelOrigen(S2, "volante")).toEqual({ workers: 2, companies: 1 });
  });
});

describe("serieACsv", () => {
  const filas = serieACsv([S1, S2]).replace(/^﻿/, "").split("\n");

  it("una fila por semana, de la más vieja a la más nueva, con BOM", () => {
    expect(serieACsv([S1]).startsWith("﻿semana,en curso,publicados")).toBe(true);
    expect(filas).toHaveLength(3);
    expect(filas[1].startsWith("2026-11-09,no,4,3,75,2,66.7,8.3,1,,2,1,1,1,")).toBe(true);
    expect(filas[2].startsWith("2026-11-16,sí,4,3,,2,66.7,,1,")).toBe(true);
  });

  it("suma una columna por origen y rol, en el orden de la serie", () => {
    expect(filas[0]).toContain(
      "altas volante trabajadores,altas volante comercios,altas ig trabajadores,altas ig comercios," +
        "altas ig/fundadores trabajadores,altas ig/fundadores comercios," +
        "altas sin dato trabajadores,altas sin dato comercios"
    );
    expect(filas[1].endsWith(",0,0,1,0,0,0,0,1")).toBe(true);
    expect(filas[2].endsWith(",2,1,0,1,1,0,0,0")).toBe(true);
  });
});
