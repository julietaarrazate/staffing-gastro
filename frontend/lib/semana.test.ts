import { describe, expect, it } from "vitest";
import {
  claveDeVista,
  claveDiaArgentina,
  diaCortoArgentina,
  diaEnPalabras,
  fechaCorta,
  rotuloSemana,
  semanaArgentina,
  semanasHasta,
  turnosPorDia,
} from "./semana";

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

describe("semanas corridas", () => {
  const AHORA = new Date("2026-11-19T18:00:00Z"); // jueves 19/11/2026 15:00 en Argentina

  it("el offset corre de a siete días y siempre arranca en lunes", () => {
    expect(semanaArgentina(AHORA, 1).map((d) => d.numero)).toEqual([23, 24, 25, 26, 27, 28, 29]);
    expect(semanaArgentina(AHORA, -1).map((d) => d.numero)).toEqual([9, 10, 11, 12, 13, 14, 15]);
    for (const k of [-6, -1, 0, 1, 7]) expect(semanaArgentina(AHORA, k)[0].corto).toBe("lun");
  });

  it("hoy sólo está marcado en la semana de hoy", () => {
    expect(semanaArgentina(AHORA, 1).some((d) => d.esHoy)).toBe(false);
    expect(semanaArgentina(AHORA, 0).filter((d) => d.esHoy)).toHaveLength(1);
  });

  it("cruza de mes yendo para adelante y para atrás", () => {
    expect(semanaArgentina(AHORA, 2).map((d) => `${d.numero}/${d.clave.slice(5, 7)}`)).toEqual([
      "30/11", "1/12", "2/12", "3/12", "4/12", "5/12", "6/12",
    ]);
    expect(semanaArgentina(new Date("2026-12-03T15:00:00Z"), -1).map((d) => d.clave)).toEqual([
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29",
    ]);
  });

  it("cruza de año: la semana del 28 dic al 3 ene, con febrero bisiesto aparte", () => {
    const fin = semanaArgentina(new Date("2026-12-30T15:00:00Z"));
    expect(fin.map((d) => d.clave)).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
    expect(rotuloSemana(fin)).toBe("28 dic – 3 ene");
    expect(semanaArgentina(new Date("2027-01-05T15:00:00Z"), -1)[6].clave).toBe("2027-01-03");
    // 2028 es bisiesto: el 29 de febrero existe.
    expect(semanaArgentina(new Date("2028-02-28T15:00:00Z")).map((d) => d.clave)).toContain("2028-02-29");
  });

  it("el lunes es el primer día aunque hoy sea domingo", () => {
    const semana = semanaArgentina(new Date("2026-11-22T15:00:00Z")); // domingo
    expect(semana[0]).toMatchObject({ clave: "2026-11-16", corto: "lun", esHoy: false });
    expect(semana[6]).toMatchObject({ clave: "2026-11-22", corto: "dom", esHoy: true });
  });

  it("cerca de la medianoche manda la hora de Argentina (UTC-3), no la de UTC", () => {
    // Sábado 21/11 23:59 ART = domingo 22 02:59 UTC.
    expect(semanaArgentina(new Date("2026-11-22T02:59:00Z")).find((d) => d.esHoy)?.clave).toBe("2026-11-21");
    // Un minuto después ya es domingo 22 en Argentina.
    expect(semanaArgentina(new Date("2026-11-22T03:00:00Z")).find((d) => d.esHoy)?.clave).toBe("2026-11-22");
    // Domingo 22 23:59 ART: sigue siendo la semana del 16; a las 00:00 ART del lunes, la del 23.
    expect(semanaArgentina(new Date("2026-11-23T02:59:00Z"))[0].clave).toBe("2026-11-16");
    expect(semanaArgentina(new Date("2026-11-23T03:00:00Z"))[0].clave).toBe("2026-11-23");
  });
});

describe("rotuloSemana, fechaCorta y diaEnPalabras", () => {
  it("rotula la semana, con o sin cambio de mes", () => {
    expect(rotuloSemana(semanaArgentina(new Date("2026-11-19T18:00:00Z")))).toBe("16 – 22 nov");
    expect(rotuloSemana(semanaArgentina(new Date("2026-12-01T15:00:00Z")))).toBe("30 nov – 6 dic");
  });
  it("da la fecha corta y el día en palabras", () => {
    expect(fechaCorta("2026-11-23")).toBe("lun 23 nov");
    expect(fechaCorta("2027-01-01")).toBe("vie 1 ene");
    expect(diaEnPalabras("2026-11-17")).toBe("martes 17");
    expect(diaEnPalabras("2026-11-22")).toBe("domingo 22");
  });
});

describe("semanasHasta", () => {
  const AHORA = new Date("2026-11-19T18:00:00Z");
  it("cuenta semanas de lunes a lunes", () => {
    expect(semanasHasta("2026-11-16", AHORA)).toBe(0);
    expect(semanasHasta("2026-11-22", AHORA)).toBe(0);
    expect(semanasHasta("2026-11-23", AHORA)).toBe(1);
    expect(semanasHasta("2026-11-15", AHORA)).toBe(-1);
    expect(semanasHasta("2027-01-04", AHORA)).toBe(7);
  });
  it("usa el día de Argentina de `ahora`: el domingo 23:59 todavía es la semana vieja", () => {
    expect(semanasHasta("2026-11-23", new Date("2026-11-23T02:59:00Z"))).toBe(1);
    expect(semanasHasta("2026-11-23", new Date("2026-11-23T03:00:00Z"))).toBe(0);
  });
  it("concuerda con semanaArgentina", () => {
    for (const k of [-3, 0, 2, 5]) {
      const dias = semanaArgentina(AHORA, k);
      for (const d of dias) expect(semanasHasta(d.clave, AHORA)).toBe(k);
    }
  });
});

describe("turnosPorDia", () => {
  it("cuenta los turnos de cada día", () => {
    const m = turnosPorDia(["2026-11-18", "2026-11-18", "2026-11-20"]);
    expect(m.get("2026-11-18")).toBe(2);
    expect(m.get("2026-11-20")).toBe(1);
    expect(m.get("2026-11-19")).toBeUndefined();
  });
});

describe("claveDeVista", () => {
  const turno = { start_at: "2026-11-22T21:00:00-03:00", end_at: "2026-11-23T03:00:00-03:00" };
  it("un turno en curso que cruzó la medianoche se muestra hoy", () => {
    expect(claveDeVista(turno, new Date("2026-11-23T01:00:00-03:00"))).toBe("2026-11-23");
  });
  it("antes de empezar y después de terminar, el día de su inicio", () => {
    expect(claveDeVista(turno, new Date("2026-11-22T20:00:00-03:00"))).toBe("2026-11-22");
    expect(claveDeVista(turno, new Date("2026-11-23T03:00:00-03:00"))).toBe("2026-11-22");
  });
  it("en curso el mismo día de su inicio: ese día", () => {
    expect(claveDeVista(turno, new Date("2026-11-22T22:00:00-03:00"))).toBe("2026-11-22");
  });
  it("sin fin conocido, el día de su inicio", () => {
    expect(claveDeVista({ start_at: turno.start_at, end_at: null }, new Date("2026-11-23T01:00:00-03:00"))).toBe("2026-11-22");
  });
});
