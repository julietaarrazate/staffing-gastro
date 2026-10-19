import { describe, expect, it } from "vitest";
import { formatArs, formatDecimal1, formatKm } from "./format";

describe("formatDecimal1 / formatKm", () => {
  it("usa coma decimal, como se escribe en Argentina", () => {
    expect(formatDecimal1(4.9)).toBe("4,9");
    expect(formatKm(0.6)).toBe("0,6 km");
  });

  it("siempre muestra un decimal, también en números redondos", () => {
    expect(formatDecimal1(5)).toBe("5,0");
    expect(formatKm(2)).toBe("2,0 km");
  });

  it("redondea a un decimal", () => {
    expect(formatKm(1.94)).toBe("1,9 km");
    expect(formatDecimal1(4.66)).toBe("4,7");
  });
});

describe("formatArs", () => {
  it("separa miles con punto y acepta el Decimal serializado como string", () => {
    expect(formatArs(20000)).toBe("$20.000");
    expect(formatArs("45000.00")).toBe("$45.000");
  });
});
