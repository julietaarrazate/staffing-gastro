import { describe, expect, it } from "vitest";
import { sheetBottomPadding } from "./camera";

describe("sheetBottomPadding", () => {
  it("deja libre el alto visible de la hoja", () => {
    expect(sheetBottomPadding(700, 0.44)).toBe(308);
    expect(sheetBottomPadding(700, 0.5)).toBe(350);
  });

  it("con la hoja casi a pantalla completa topa en 55% del contenedor", () => {
    expect(sheetBottomPadding(700, 0.88)).toBe(385);
  });

  it("es 0 sin contenedor medido o sin hoja", () => {
    expect(sheetBottomPadding(0, 0.44)).toBe(0);
    expect(sheetBottomPadding(700, 0)).toBe(0);
    expect(sheetBottomPadding(Number.NaN, 0.44)).toBe(0);
  });
});
