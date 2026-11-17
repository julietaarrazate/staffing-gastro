import { describe, expect, it } from "vitest";
import { edadEn, hoyArgentina, motivoFechaNacimiento, nacimientoMasReciente } from "./edad";

const HOY = "2026-11-17";

describe("motivoFechaNacimiento", () => {
  it("cumple 18 hoy: puede", () => expect(motivoFechaNacimiento("2008-11-17", HOY)).toBeNull());
  it("cumple 18 mañana: no puede", () =>
    expect(motivoFechaNacimiento("2008-11-18", HOY)).toBe("Oído es sólo para mayores de 18 años."));
  it("vacía", () => expect(motivoFechaNacimiento("", HOY)).toMatch(/Escribí tu fecha/));
  it("futura", () => expect(motivoFechaNacimiento("2027-01-01", HOY)).toBe("Revisá tu fecha de nacimiento."));
  it("de hace más de cien años", () =>
    expect(motivoFechaNacimiento("1095-05-20", HOY)).toBe("Revisá tu fecha de nacimiento."));
  it("que no existe", () => expect(motivoFechaNacimiento("2001-02-30", HOY)).toBe("Revisá tu fecha de nacimiento."));
});

describe("edadEn", () => {
  it("29 de febrero cumple el 1 de marzo", () => {
    expect(edadEn("2008-02-29", "2026-02-28")).toBe(17);
    expect(edadEn("2008-02-29", "2026-03-01")).toBe(18);
  });
});

describe("nacimientoMasReciente", () => {
  it("hoy menos 18 años", () => expect(nacimientoMasReciente(HOY)).toBe("2008-11-17"));
  it("29 de febrero de un bisiesto pasa al 28", () => expect(nacimientoMasReciente("2028-02-29")).toBe("2010-02-28"));
});

describe("hoyArgentina", () => {
  it("usa la hora de Argentina, no la UTC", () =>
    // 02:00 UTC del 18 son las 23:00 del 17 en Argentina.
    expect(hoyArgentina(new Date("2026-11-18T02:00:00Z"))).toBe("2026-11-17"));
});
