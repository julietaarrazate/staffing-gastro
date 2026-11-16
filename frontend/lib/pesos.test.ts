import { describe, expect, it } from "vitest";
import { formatearPesos, leerPesos, pesosDesdeApi } from "./pesos";

describe("leerPesos", () => {
  it.each([
    ["15000", "15000"],
    ["15.000", "15000"],
    ["1.500.000", "1500000"],
    ["$ 15.000", "15000"],
    [" 15000 ", "15000"],
    ["15000,50", "15001"], // el grave: antes publicaba $1.500.050
    ["15000,5", "15001"],
    ["15.000,49", "15000"],
    ["15000,", "15000"],
    ["15000,99", "15001"],
    [",6", "1"],
    ["0", "0"],
    ["", ""],
    ["   ", ""],
  ])("«%s» → «%s»", (texto, esperado) => {
    expect(leerPesos(texto)).toBe(esperado);
  });

  it.each(["15.00", "1.5", "15000.5", "1234.567", "1,000,000", "15a", "-15000", ",", "15..000", ".000"])(
    "«%s» no es un monto",
    (texto) => {
      expect(leerPesos(texto)).toBeNull();
    }
  );

  it("no pierde precisión con montos enormes", () => {
    expect(leerPesos("9.007.199.254.740.993,5")).toBe("9007199254740994");
  });
});

describe("formatearPesos", () => {
  it("separa los miles con punto", () => {
    expect(formatearPesos("15001")).toBe("15.001");
    expect(formatearPesos("1500000")).toBe("1.500.000");
    expect(formatearPesos("500")).toBe("500");
  });

  it("vacío o no canónico queda como está", () => {
    expect(formatearPesos("")).toBe("");
    expect(formatearPesos("15,5")).toBe("15,5");
  });

  it("ida y vuelta: lo formateado se vuelve a leer igual", () => {
    expect(leerPesos(formatearPesos("1234567"))).toBe("1234567");
  });
});

describe("pesosDesdeApi", () => {
  it("el decimal de la API (punto) se redondea al peso", () => {
    expect(pesosDesdeApi("15000.00")).toBe("15000");
    expect(pesosDesdeApi("15000.50")).toBe("15001");
    expect(pesosDesdeApi(45000)).toBe("45000");
  });

  it("nada o algo inválido queda vacío", () => {
    expect(pesosDesdeApi(null)).toBe("");
    expect(pesosDesdeApi(undefined)).toBe("");
    expect(pesosDesdeApi("")).toBe("");
    expect(pesosDesdeApi("abc")).toBe("");
    expect(pesosDesdeApi("-5")).toBe("");
  });
});
