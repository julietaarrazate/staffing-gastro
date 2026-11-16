import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { MapRef } from "@vis.gl/react-maplibre";
import { applyBottomPadding, easeToPoint, sheetBottomPadding } from "./camera";

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

describe("padding de la hoja y vuelos", () => {
  const fake = (moving: boolean) =>
    ({ isMoving: () => moving, jumpTo: vi.fn(), flyTo: vi.fn(), easeTo: vi.fn() }) as unknown as MapRef & {
      jumpTo: ReturnType<typeof vi.fn>;
      flyTo: ReturnType<typeof vi.fn>;
      easeTo: ReturnType<typeof vi.fn>;
    };

  it("los vuelos llevan el padding vigente", () => {
    const map = fake(false);
    easeToPoint(map, [-34.5, -58.4], { zoom: 15, bottomPadding: 300 });
    expect(map.easeTo.mock.calls[0][0].padding).toEqual({ top: 0, left: 0, right: 0, bottom: 300 });
  });

  it("si no se movía, sólo salta el padding", () => {
    const map = fake(false);
    applyBottomPadding(map, 300, { kind: "fly", center: [-34.5, -58.4], options: { zoom: 14 } });
    expect(map.jumpTo).toHaveBeenCalledWith({ padding: { top: 0, left: 0, right: 0, bottom: 300 } });
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it("si un vuelo estaba en curso, lo reanuda al MISMO destino con el padding nuevo", () => {
    const map = fake(true);
    applyBottomPadding(map, 120, { kind: "fly", center: [-34.5, -58.4], options: { zoom: 14, bottomPadding: 300 } });
    const call = map.flyTo.mock.calls[0][0];
    expect(call.center).toEqual([-58.4, -34.5]);
    expect(call.zoom).toBe(14);
    expect(call.padding.bottom).toBe(120);
  });
});
