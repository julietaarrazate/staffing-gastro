import { describe, expect, it } from "vitest";
import { estimateTravelTimes } from "./travel-time";

describe("estimateTravelTimes", () => {
  it("aplica el factor de red vial (1.3x) antes de calcular minutos por modo", () => {
    // distanceKm=1 -> roadDistanceKm=1.3km. walk 4.5km/h, bike 12km/h, car 18km/h.
    const times = estimateTravelTimes(1);
    expect(times.walkMin).toBe(Math.round((1.3 / 4.5) * 60)); // 17
    expect(times.bikeMin).toBe(Math.round((1.3 / 12) * 60)); // 7
    expect(times.carMin).toBe(Math.round((1.3 / 18) * 60)); // 4
  });

  it("nunca redondea a menos de 1 minuto, aunque la distancia sea mínima", () => {
    const times = estimateTravelTimes(0.001);
    expect(times.walkMin).toBeGreaterThanOrEqual(1);
    expect(times.bikeMin).toBeGreaterThanOrEqual(1);
    expect(times.carMin).toBeGreaterThanOrEqual(1);
  });

  it("a mayor distancia, más tiempo en todos los modos", () => {
    const near = estimateTravelTimes(1);
    const far = estimateTravelTimes(10);
    expect(far.walkMin).toBeGreaterThan(near.walkMin);
    expect(far.bikeMin).toBeGreaterThan(near.bikeMin);
    expect(far.carMin).toBeGreaterThan(near.carMin);
  });

  it("a la misma distancia, caminar tarda más que bici, y bici más que auto", () => {
    const times = estimateTravelTimes(5);
    expect(times.walkMin).toBeGreaterThan(times.bikeMin);
    expect(times.bikeMin).toBeGreaterThan(times.carMin);
  });
});
