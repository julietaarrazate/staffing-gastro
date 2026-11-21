import { describe, expect, it } from "vitest";
import type { Shift } from "@/lib/types";
import { MAX_URGENTES, VENTANA_URGENTES_MS, empiezaEn, faltaEn, urgentesDe } from "./urgentes";

const AHORA = new Date("2026-11-21T12:00:00-03:00");
const MIN = 60_000;
const H = 60 * MIN;

/** Un turno que empieza `ms` después de AHORA. */
const empezandoEn = (id: string, ms: number) => ({ id, start_at: new Date(AHORA.getTime() + ms).toISOString() }) as Shift;
const ids = (xs: { shift: Shift }[]) => xs.map((x) => x.shift.id);

describe("urgentesDe: la ventana de 6 horas", () => {
  it("entra el que empieza dentro de la ventana", () => {
    const r = urgentesDe([empezandoEn("a", 100 * MIN)], AHORA);
    expect(ids(r)).toEqual(["a"]);
    expect(r[0].faltaMs).toBe(100 * MIN);
  });

  it("borde de arriba: justo 6 h entra, 6 h y 1 ms no", () => {
    expect(ids(urgentesDe([empezandoEn("a", VENTANA_URGENTES_MS)], AHORA))).toEqual(["a"]);
    expect(urgentesDe([empezandoEn("a", VENTANA_URGENTES_MS + 1)], AHORA)).toEqual([]);
  });

  it("borde de abajo: empieza en 1 ms entra; empieza ahora o ya empezó, no", () => {
    expect(ids(urgentesDe([empezandoEn("a", 1)], AHORA))).toEqual(["a"]);
    expect(urgentesDe([empezandoEn("a", 0)], AHORA)).toEqual([]);
    expect(urgentesDe([empezandoEn("a", -1)], AHORA)).toEqual([]);
    expect(urgentesDe([empezandoEn("a", -2 * H)], AHORA)).toEqual([]);
  });

  it("no entra el de mañana ni el de una fecha ilegible", () => {
    const roto = { id: "x", start_at: "no es una fecha" } as Shift;
    expect(urgentesDe([empezandoEn("a", 24 * H), roto], AHORA)).toEqual([]);
  });

  it("no depende de la zona: el mismo instante en otra zona da lo mismo", () => {
    const enUtc = { id: "a", start_at: "2026-11-21T17:00:00Z" } as Shift; // 14:00 en Argentina
    const enOtraZona = { id: "b", start_at: "2026-11-21T19:00:00+02:00" } as Shift; // el mismo instante
    const r = urgentesDe([enUtc, enOtraZona], AHORA);
    expect(r.map((x) => x.faltaMs)).toEqual([2 * H, 2 * H]);
  });

  it("no cambia la lista que recibe", () => {
    const entrada = [empezandoEn("b", 3 * H), empezandoEn("a", 1 * H)];
    urgentesDe(entrada, AHORA);
    expect(ids(entrada.map((shift) => ({ shift })))).toEqual(["b", "a"]);
  });
});

describe("urgentesDe: orden y tope", () => {
  it("el que empieza antes, primero", () => {
    const r = urgentesDe([empezandoEn("tarde", 5 * H), empezandoEn("ya", 10 * MIN), empezandoEn("medio", 2 * H)], AHORA);
    expect(ids(r)).toEqual(["ya", "medio", "tarde"]);
  });

  it("a igual hora, queda el orden en que vinieron (el de cercanía del Inicio)", () => {
    const r = urgentesDe([empezandoEn("cerca", H), empezandoEn("lejos", H)], AHORA);
    expect(ids(r)).toEqual(["cerca", "lejos"]);
  });

  it("como mucho 8, y son los 8 que empiezan antes", () => {
    const muchos = Array.from({ length: 12 }, (_, i) => empezandoEn(`s${i}`, (12 - i) * 10 * MIN));
    const r = urgentesDe(muchos, AHORA);
    expect(r).toHaveLength(MAX_URGENTES);
    expect(ids(r)).toEqual(["s11", "s10", "s9", "s8", "s7", "s6", "s5", "s4"]);
  });

  it("sin turnos, nada", () => {
    expect(urgentesDe([], AHORA)).toEqual([]);
  });
});

describe("la cuenta regresiva", () => {
  it.each([
    [45 * MIN, "45 min"],
    [1 * MIN, "1 min"],
    [59 * MIN, "59 min"],
    [60 * MIN, "1 h"],
    [100 * MIN, "1 h 40"],
    [125 * MIN, "2 h 5"],
    [5 * H, "5 h"],
    [6 * H, "6 h"],
  ])("%i ms → «%s»", (ms, texto) => {
    expect(faltaEn(ms)).toBe(texto);
  });

  it("redondea los minutos para arriba y no baja de 1", () => {
    expect(faltaEn(1)).toBe("1 min");
    expect(faltaEn(59_000)).toBe("1 min");
    expect(faltaEn(44 * MIN + 1)).toBe("45 min");
    expect(faltaEn(59 * MIN + 1)).toBe("1 h");
    expect(faltaEn(5 * H + 1)).toBe("5 h 1");
  });

  it("empiezaEn arma la frase", () => {
    expect(empiezaEn(100 * MIN)).toBe("Empieza en 1 h 40");
    expect(empiezaEn(5 * H)).toBe("Empieza en 5 h");
  });
});
