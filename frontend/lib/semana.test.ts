import { describe, expect, it } from "vitest";
import { claveDiaArgentina, diaCortoArgentina, semanaArgentina } from "./semana";

describe("semanaArgentina", () => {
  it("va de lunes a domingo y marca hoy", () => {
    // Jueves 19/11/2026, 15:00 en Argentina.
    const semana = semanaArgentina(new Date("2026-11-19T18:00:00Z"));
    expect(semana.map((d) => `${d.corto} ${d.numero}`)).toEqual([
      "lun 16", "mar 17", "mié 18", "jue 19", "vie 20", "sáb 21", "dom 22",
    ]);
    expect(semana.filter((d) => d.esHoy).map((d) => d.clave)).toEqual(["2026-11-19"]);
  });

  it("usa el día de Argentina, no el de UTC (domingo 23:30 sigue siendo domingo)", () => {
    // Lunes 02:30 UTC = domingo 23:30 en Argentina.
    const semana = semanaArgentina(new Date("2026-11-23T02:30:00Z"));
    expect(semana[6]).toMatchObject({ clave: "2026-11-22", esHoy: true });
    expect(semana[0].clave).toBe("2026-11-16");
  });

  it("cruza de mes", () => {
    const semana = semanaArgentina(new Date("2026-12-01T15:00:00Z"));
    expect(semana.map((d) => d.numero)).toEqual([30, 1, 2, 3, 4, 5, 6]);
  });
});

describe("el día de un turno", () => {
  it("un turno de las 23:00 de Argentina cae en su día, no en el siguiente de UTC", () => {
    expect(claveDiaArgentina("2026-11-22T02:00:00Z")).toBe("2026-11-21");
    expect(diaCortoArgentina("2026-11-22T02:00:00Z")).toEqual({ corto: "sáb", numero: 21 });
  });
});
