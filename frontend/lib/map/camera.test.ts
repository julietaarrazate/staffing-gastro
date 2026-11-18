import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { MapRef } from "@vis.gl/react-maplibre";
import { createBottomPaddingApplier, easeToPoint, sheetBottomPadding } from "./camera";

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
});

describe("createBottomPaddingApplier", () => {
  function movingMap(moving: boolean) {
    let handler: (() => void) | null = null;
    const m = {
      moving,
      isMoving: () => m.moving,
      jumpTo: vi.fn(),
      once: vi.fn((_n: string, h: () => void) => {
        handler = h;
      }),
      off: vi.fn((_n: string, h: () => void) => {
        if (handler === h) handler = null;
      }),
      fireMoveEnd() {
        const h = handler;
        handler = null;
        m.moving = false;
        h?.();
      },
      hasListener: () => handler !== null,
    };
    return m;
  }
  const pad = (bottom: number) => ({ padding: { top: 0, left: 0, right: 0, bottom } });

  it("quieto: aplica en el momento", () => {
    const m = movingMap(false);
    createBottomPaddingApplier(m as unknown as MapRef).apply(300);
    expect(m.jumpTo).toHaveBeenCalledWith(pad(300));
    expect(m.once).not.toHaveBeenCalled();
  });

  it("en movimiento: espera al moveend y aplica el último valor", () => {
    const m = movingMap(true);
    const a = createBottomPaddingApplier(m as unknown as MapRef);
    a.apply(300);
    expect(m.jumpTo).not.toHaveBeenCalled();
    m.fireMoveEnd();
    expect(m.jumpTo).toHaveBeenCalledTimes(1);
    expect(m.jumpTo).toHaveBeenCalledWith(pad(300));
  });

  it("dos cambios durante el movimiento: un solo listener y gana el último", () => {
    const m = movingMap(true);
    const a = createBottomPaddingApplier(m as unknown as MapRef);
    a.apply(300);
    a.apply(120);
    expect(m.once).toHaveBeenCalledTimes(1);
    m.fireMoveEnd();
    expect(m.jumpTo).toHaveBeenCalledTimes(1);
    expect(m.jumpTo).toHaveBeenCalledWith(pad(120));
  });

  it("el moveend del propio jumpTo no entra en bucle", () => {
    const m = movingMap(true);
    const a = createBottomPaddingApplier(m as unknown as MapRef);
    a.apply(300);
    m.fireMoveEnd();
    m.fireMoveEnd(); // el moveend que dispararía el jumpTo: no hay listener
    expect(m.jumpTo).toHaveBeenCalledTimes(1);
    expect(m.once).toHaveBeenCalledTimes(1);
  });

  it("cleanup: cancela el listener y no aplica nada", () => {
    const m = movingMap(true);
    const a = createBottomPaddingApplier(m as unknown as MapRef);
    a.apply(300);
    a.cancel();
    expect(m.hasListener()).toBe(false);
    m.fireMoveEnd();
    expect(m.jumpTo).not.toHaveBeenCalled();
  });
});
