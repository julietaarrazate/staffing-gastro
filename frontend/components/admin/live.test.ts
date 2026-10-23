import { describe, expect, it } from "vitest";
import { formatDelta, formatMinutesOpen, periodDelta } from "./live";

describe("formatMinutesOpen", () => {
  it("minutos, horas y días", () => {
    expect(formatMinutesOpen(0)).toBe("0 min");
    expect(formatMinutesOpen(8.9)).toBe("8 min");
    expect(formatMinutesOpen(60)).toBe("1 h");
    expect(formatMinutesOpen(65)).toBe("1 h 05");
    expect(formatMinutesOpen(24 * 60)).toBe("1 d");
    expect(formatMinutesOpen(2 * 24 * 60 + 190)).toBe("2 d 3 h");
    expect(formatMinutesOpen(-3)).toBe("0 min");
  });
});

describe("periodDelta", () => {
  it("sube y baja con el % sobre el período anterior", () => {
    expect(periodDelta(12, 8)).toEqual({ direction: "up", pct: 50, good: true });
    expect(periodDelta(6, 8)).toEqual({ direction: "down", pct: 25, good: false });
  });

  it("en el tiempo hasta cubrir, bajar es bueno", () => {
    expect(periodDelta(6, 12, { lowerIsBetter: true })).toEqual({
      direction: "down",
      pct: 50,
      good: true,
    });
    expect(periodDelta(15, 12, { lowerIsBetter: true }).good).toBe(false);
  });

  it("sin cambio, sin base o sin dato", () => {
    expect(periodDelta(5, 5)).toEqual({ direction: "flat", pct: 0, good: null });
    expect(periodDelta(3, 0)).toEqual({ direction: "up", pct: null, good: true });
    expect(periodDelta(null, 4)).toEqual({ direction: "flat", pct: null, good: null });
    expect(periodDelta(4, null).pct).toBeNull();
  });
});

describe("formatDelta", () => {
  it("flecha y porcentaje", () => {
    expect(formatDelta(periodDelta(12, 8))).toBe("↑ 50 %");
    expect(formatDelta(periodDelta(6, 8))).toBe("↓ 25 %");
    expect(formatDelta(periodDelta(5, 5))).toBe("= igual");
    expect(formatDelta(periodDelta(3, 0))).toBe("↑ desde 0");
    expect(formatDelta(periodDelta(null, 2))).toBe("sin datos");
  });
});
