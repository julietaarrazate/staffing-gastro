import { describe, expect, it } from "vitest";
import { diasParaDuplicar, resolverHorario } from "./turno-horario";

// 2026-11-20 12:00 hora de Argentina (UTC-3) = 15:00 UTC.
const AHORA = new Date("2026-11-20T15:00:00Z");

describe("resolverHorario", () => {
  it("acepta un turno de hoy más tarde, de 6 horas", () => {
    const h = resolverHorario("2026-11-20T18:00", "2026-11-21T00:00", AHORA);
    expect(h.valido).toBe(true);
    expect(h.minutos).toBe(360);
    expect(h.alDiaSiguiente).toBe(false);
  });

  it("tolera un inicio de hace 5 minutos y rechaza uno de hace 6", () => {
    expect(resolverHorario("2026-11-20T11:55", "2026-11-20T15:00", AHORA).errorInicio).toBeNull();
    const h = resolverHorario("2026-11-20T11:54", "2026-11-20T15:00", AHORA);
    expect(h.errorInicio).toMatch(/ya pasó/);
    expect(h.valido).toBe(false);
  });

  it("toma el fin anterior al inicio del mismo día como el día siguiente", () => {
    const h = resolverHorario("2026-11-21T21:00", "2026-11-21T02:00", AHORA);
    expect(h.alDiaSiguiente).toBe(true);
    expect(h.fin).toBe("2026-11-22T02:00");
    expect(h.minutos).toBe(5 * 60);
    expect(h.valido).toBe(true);
  });

  it("no adivina cuando la fecha del fin es anterior a la del inicio", () => {
    const h = resolverHorario("2026-11-21T21:00", "2026-11-20T23:00", AHORA);
    expect(h.alDiaSiguiente).toBe(false);
    expect(h.errorFin).toMatch(/después del inicio/);
  });

  it("fin igual al inicio es un error, no un turno de 24 horas", () => {
    const h = resolverHorario("2026-11-21T10:00", "2026-11-21T10:00", AHORA);
    expect(h.errorFin).toMatch(/distinto del inicio/);
  });

  it("pide al menos 1 hora y hasta 16", () => {
    expect(resolverHorario("2026-11-21T10:00", "2026-11-21T10:59", AHORA).errorFin).toMatch(/al menos 1 hora/);
    expect(resolverHorario("2026-11-21T10:00", "2026-11-21T11:00", AHORA).valido).toBe(true);
    expect(resolverHorario("2026-11-21T10:00", "2026-11-22T02:00", AHORA).valido).toBe(true);
    expect(resolverHorario("2026-11-21T10:00", "2026-11-22T02:01", AHORA).errorFin).toMatch(/hasta 16 horas/);
  });

  it("si pasar al día siguiente da más de 16 horas, dice que el fin quedó antes del inicio", () => {
    const h = resolverHorario("2026-11-21T10:00", "2026-11-21T09:00", AHORA);
    expect(h.alDiaSiguiente).toBe(true);
    expect(h.errorFin).toMatch(/fin quedó antes del inicio/);
    expect(h.valido).toBe(false);
  });

  it("no es válido mientras falte un extremo", () => {
    expect(resolverHorario("", "", AHORA).valido).toBe(false);
    expect(resolverHorario("2026-11-21T10:00", "", AHORA).valido).toBe(false);
  });
});

describe("diasParaDuplicar", () => {
  it("una semana si el original es de hoy o futuro", () => {
    expect(diasParaDuplicar("2026-11-20T18:00:00-03:00", AHORA)).toBe(7);
  });
  it("la próxima semana que no pasó si el original es viejo", () => {
    expect(diasParaDuplicar("2026-10-30T18:00:00-03:00", AHORA)).toBe(21);
  });
});
