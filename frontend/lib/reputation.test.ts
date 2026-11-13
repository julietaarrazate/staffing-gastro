import { describe, expect, it } from "vitest";
import {
  formatPunctuality,
  formatRateOrNone,
  formatRating,
  formatRatingOrNone,
  hasPaymentRate,
  hasRate,
  hasRating,
} from "./reputation";

// "Sin reseñas no es cero" (U020): la API manda 0 para quien todavía no tiene
// nota, y 0 no puede llegar a la pantalla como "0,0" ni como "0 %".
describe("hasRating", () => {
  it("0 significa sin reseñas", () => {
    expect(hasRating(0)).toBe(false);
    expect(hasRating(null)).toBe(false);
    expect(hasRating(undefined)).toBe(false);
    expect(hasRating(Number.NaN)).toBe(false);
  });
  it("una nota de 1 a 5 es una nota", () => {
    expect(hasRating(1)).toBe(true);
    expect(hasRating(4.5)).toBe(true);
  });
});

describe("formatRating", () => {
  it("usa coma decimal", () => {
    expect(formatRating(4.5)).toBe("4,5");
    expect(formatRating(4)).toBe("4,0");
  });
  it("en tablas de datos, sin reseñas dice «Sin reseñas», no 0,0", () => {
    expect(formatRatingOrNone(0)).toBe("Sin reseñas");
    expect(formatRatingOrNone(4.25)).toBe("4,3");
  });
});

describe("puntualidad", () => {
  it("sin turnos terminados no hay porcentaje", () => {
    expect(hasRate(0)).toBe(false);
    expect(hasRate(undefined)).toBe(false);
    expect(formatRateOrNone(0, 0)).toBe("Sin datos");
  });
  it("con turnos terminados se muestra, incluso si es 0 % de verdad", () => {
    expect(hasRate(3)).toBe(true);
    expect(formatRateOrNone(0.92, 3)).toBe("92%");
    expect(formatRateOrNone(0, 2)).toBe("0%");
    expect(formatPunctuality(0.925)).toBe("93%");
  });
});

describe("hasPaymentRate (Pago a tiempo del comercio)", () => {
  it("sin pagos registrados no hay «Pago a tiempo», aunque haya turnos publicados", () => {
    expect(hasPaymentRate(0, 5)).toBe(false);
  });
  it("con pagos registrados se muestra", () => {
    expect(hasPaymentRate(1, 5)).toBe(true);
  });
  it("si el campo no viene (app vieja o caché) cae a los turnos publicados", () => {
    expect(hasPaymentRate(undefined, 0)).toBe(false);
    expect(hasPaymentRate(undefined, 3)).toBe(true);
  });
});
