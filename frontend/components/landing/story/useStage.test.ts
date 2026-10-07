import { describe, expect, it } from "vitest";
import { HYSTERESIS, stepFor } from "./useStage";

const STOPS = [0.2, 0.5, 0.8] as const;

describe("stepFor", () => {
  it("cuenta cuántos umbrales se pasaron", () => {
    expect(stepFor(0, 0, STOPS)).toBe(0);
    expect(stepFor(0.6, 0, STOPS)).toBe(2);
    expect(stepFor(1, 0, STOPS)).toBe(3);
  });

  it("no cambia de paso justo en el borde (histéresis)", () => {
    // Recién pasado el umbral, todavía no avanza…
    expect(stepFor(0.2 + HYSTERESIS / 2, 0, STOPS)).toBe(0);
    // …y una vez adentro, volver apenas por debajo no lo hace retroceder.
    expect(stepFor(0.2 - HYSTERESIS / 2, 1, STOPS)).toBe(1);
  });

  it("un salto grande (flick) llega directo al paso que corresponde", () => {
    expect(stepFor(0.95, 0, STOPS)).toBe(3);
    expect(stepFor(0.05, 3, STOPS)).toBe(0);
  });
});
